import type {
  ClientMessage,
  ServerMessage,
  ServerHelloMessage,
  ServerMutationMessage,
  ServerPresenceMessage,
  MutationOp,
  PeerEntry,
} from "../types/live";
import { newMutationId } from "./identity";

/// Splitea live WebSocket client. Owns the connection
/// lifecycle (connect, retry with backoff, idle-aware close)
/// and translates incoming frames into typed callbacks the
/// store can consume.
///
/// **Identity over query string, not headers.** The browser
/// `WebSocket` API can't set custom headers on the upgrade
/// request, so we pass `userId` and `displayName` as query
/// params. The DO side accepts both (header-first, query-
/// fallback) — see `splitea-live/src/receiptSession.ts`.
///
/// **Replay & gap handling.** `latestSeenSeq` is exposed via
/// `updateLastSeenSeq` so the store can persist it. On
/// reconnect we send `?resume=<seq>` and the relay either
/// replays just the tail or sends `resumeGap: true` if the
/// log no longer covers our cursor (in which case the caller
/// should refetch the snapshot before applying any further
/// deltas).
export interface LiveSessionOptions {
  shareID: string;
  userId: string;
  displayName?: string;
  /// Highest seq this client has already applied. Persisted
  /// across reconnects (and reloads, if the caller stores it
  /// in localStorage). `null`/`0` means "send me the whole
  /// surviving log" (the relay only retains the last 5000
  /// mutations / 1 hour idle anyway, so the worst case is
  /// bounded).
  initialResumeSeq?: number | null;
  onHello?: (msg: ServerHelloMessage) => void;
  onMutation?: (msg: ServerMutationMessage) => void;
  onPresence?: (peers: PeerEntry[]) => void;
  /// Emitted on any state transition for status-bar display.
  /// One of: "connecting" | "open" | "closed" | "reconnecting".
  onStatus?: (status: LiveStatus) => void;
  /// Fired when the owner toggles edit-lock from another client.
  /// Initial value also arrives via `onHello`'s `editLocked`.
  onLockStatusChanged?: (editLocked: boolean) => void;
}

export type LiveStatus = "connecting" | "open" | "reconnecting" | "closed";

const PROTOCOL_VERSION = "splitea.v1";
const MAX_RECONNECT_DELAY_MS = 30_000;
const INITIAL_RECONNECT_DELAY_MS = 2_000;
/// Time we wait for a `pong` after sending a `ping` before
/// declaring the socket a zombie and force-reconnecting.
/// Safari is the main offender here: it freezes background
/// tabs, kills the underlying TCP connection silently, and
/// when the tab returns to foreground the WebSocket's
/// `readyState` still reads `OPEN` for tens of seconds before
/// the runtime finally fires `close`. The watchdog short-
/// circuits that wait — if we don't hear a `pong` in 4s, we
/// bin the socket and reconnect. The DO replies to `ping`
/// from its runtime layer (no DO wakeup), so this is cheap.
const ZOMBIE_PROBE_TIMEOUT_MS = 4_000;

export class LiveSession {
  private ws: WebSocket | null = null;
  private status: LiveStatus = "closed";
  private reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private lastSeenSeq: number;
  private intentionallyClosed = false;
  private opts: LiveSessionOptions;
  private zombieProbeTimer: ReturnType<typeof setTimeout> | null = null;
  /// Refs to the global listeners we install in `open()` so
  /// we can detach them in `close()`. Without this they'd
  /// leak across SPA navigations / hot reloads and pile up
  /// duplicate reconnect storms on every visibility change.
  private visibilityHandler: (() => void) | null = null;
  private onlineHandler: (() => void) | null = null;
  /// Mirrors the server's `editLocked` flag. When true,
  /// `sendMutation` short-circuits — the server would silently
  /// drop peer ops anyway, but gating client-side keeps us
  /// from emitting frames the relay throws away.
  private editLocked = false;

  constructor(opts: LiveSessionOptions) {
    this.opts = opts;
    this.lastSeenSeq = opts.initialResumeSeq ?? 0;
  }

  open() {
    this.intentionallyClosed = false;

    // Wake-from-background recovery. Safari (especially on
    // iOS) puts background tabs into a "page lifecycle
    // frozen" state — TCP connections are torn down silently
    // and the WebSocket's `close` event may not fire until
    // long after the tab returns to foreground. We treat any
    // visibilitychange-to-visible as a hint that we should
    // verify the socket's still alive and reconnect aggressively
    // if not. Same handler covers desktop tab switches; the
    // overhead (one ping per resume) is negligible.
    this.visibilityHandler = () => {
      if (document.visibilityState !== "visible") return;
      this.checkLiveness();
    };
    document.addEventListener("visibilitychange", this.visibilityHandler);

    // Network recovery — the OS just told us we're back online
    // after a flaky network event (Wi-Fi handoff, cell→Wi-Fi,
    // VPN flip). Same recovery path as the visibility one.
    this.onlineHandler = () => {
      this.checkLiveness();
    };
    window.addEventListener("online", this.onlineHandler);

    this.connect();
  }

  close() {
    this.intentionallyClosed = true;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.clearZombieProbe();
    if (this.visibilityHandler) {
      document.removeEventListener("visibilitychange", this.visibilityHandler);
      this.visibilityHandler = null;
    }
    if (this.onlineHandler) {
      window.removeEventListener("online", this.onlineHandler);
      this.onlineHandler = null;
    }
    if (this.ws) {
      try {
        this.ws.close(1000, "client closing");
      } catch {
        /* swallow */
      }
      this.ws = null;
    }
    this.transition("closed");
  }

  /// Called when the page returns from background or the OS
  /// reports the network is back. Three possible socket states:
  ///
  ///   • Already null / CLOSED / CLOSING → cancel any pending
  ///     backoff and reconnect immediately. Background-suspended
  ///     tabs often miss a scheduled reconnect tick; we don't
  ///     want to wait the full backoff just because we're now
  ///     visible again.
  ///   • OPEN → maybe a zombie. Send a ping, start the
  ///     watchdog. If we get a pong (or any frame) before the
  ///     timeout, the socket is healthy. If not, we kill it
  ///     and reconnect.
  ///   • CONNECTING → leave it; the open/close handlers will
  ///     fire normally.
  private checkLiveness() {
    if (this.intentionallyClosed) return;
    const ws = this.ws;
    if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
      // Reset backoff so the wake-up reconnect feels instant
      // rather than the user waiting on a 30s exponential tail.
      this.reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
      if (this.reconnectTimer !== null) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      this.connect();
      return;
    }
    if (ws.readyState !== WebSocket.OPEN) return;

    // Zombie probe — send a ping and wait. Any frame from the
    // server (pong or otherwise) cancels the watchdog via
    // `clearZombieProbe` in `handleFrame`.
    try {
      ws.send(JSON.stringify({ type: "ping" }));
    } catch {
      // Send already failing means the socket's gone; force-
      // close to bring `onclose` → reconnect.
      this.forceCloseAndReconnect();
      return;
    }
    this.clearZombieProbe();
    this.zombieProbeTimer = setTimeout(() => {
      this.zombieProbeTimer = null;
      this.forceCloseAndReconnect();
    }, ZOMBIE_PROBE_TIMEOUT_MS);
  }

  private forceCloseAndReconnect() {
    this.clearZombieProbe();
    if (this.ws) {
      try {
        // 4001 is our "client suspects zombie" code. The DO
        // doesn't read it; it's purely a signal in browser
        // devtools so a developer triaging a stuck connection
        // can see why we tore it down.
        this.ws.close(4001, "client liveness probe failed");
      } catch {
        /* swallow */
      }
      this.ws = null;
    }
    this.reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.connect();
  }

  private clearZombieProbe() {
    if (this.zombieProbeTimer !== null) {
      clearTimeout(this.zombieProbeTimer);
      this.zombieProbeTimer = null;
    }
  }

  /// `true` when peers are allowed to send mutations. Callers
  /// should gate optimistic local applies on this too — when
  /// the share is locked, taps shouldn't even flash visually.
  get canEdit(): boolean {
    return !this.editLocked;
  }

  /// Send a mutation op. Returns the mutation id so the
  /// caller can correlate optimistic local state with the
  /// server's eventual broadcast (or, for non-bulk ops where
  /// the server doesn't echo, just so the caller has it).
  /// Returns null when the share is edit-locked (no-op).
  sendMutation(op: MutationOp): string | null {
    if (this.editLocked) return null;
    const id = newMutationId();
    this.send({ type: "mutation", id, op });
    return id;
  }

  /// Fire-and-forget; if the socket is closed the message is
  /// dropped (the optimistic local update has already been
  /// applied and the user's intent will be re-sent if needed
  /// by higher-level retry logic — not implemented here).
  private send(msg: ClientMessage) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      this.ws.send(JSON.stringify(msg));
    } catch {
      /* swallow — onclose will fire and trigger reconnect */
    }
  }

  private connect() {
    this.transition(this.lastSeenSeq > 0 ? "reconnecting" : "connecting");
    const url = this.buildURL();
    let ws: WebSocket;
    try {
      // Subprotocol negotiation — the DO accepts unknown
      // subprotocols silently for back-compat, but advertising
      // `splitea.v1` lets it route us through the v1 dispatch
      // path explicitly.
      ws = new WebSocket(url, [PROTOCOL_VERSION]);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;
    // Capture the socket reference in each handler closure
    // and identity-check against `this.ws` before doing
    // anything stateful. Without this, if `forceCloseAndReconnect`
    // replaces the socket while the old one's `close` event
    // is still in flight, the stale listener would clobber
    // the new `this.ws = null` and schedule a duplicate
    // reconnect — producing a "reconnect storm" pattern that
    // can flood the relay.
    const myWs = ws;
    myWs.addEventListener("open", () => {
      if (this.ws !== myWs) return;
      this.reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
      this.transition("open");
    });
    myWs.addEventListener("message", (ev) => {
      if (this.ws !== myWs) return;
      this.handleFrame(ev.data);
    });
    myWs.addEventListener("close", () => {
      if (this.ws !== myWs) return; // already replaced; stale event
      this.ws = null;
      this.clearZombieProbe();
      if (this.intentionallyClosed) return;
      this.scheduleReconnect();
    });
    myWs.addEventListener("error", () => {
      // The 'close' handler will fire next and own the
      // reconnect — no double-schedule from here.
    });
  }

  private buildURL(): string {
    // wss://splitea.app/live/session/<shareID>?userId=...&displayName=...&resume=...
    //
    // The Worker route at the apex strips `/live/` and forwards
    // to the DO that owns the shareID (deterministic via
    // `idFromName`). Prefer same-origin so the URL works the
    // same in dev (`http://localhost:5173` proxied) and prod.
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const params = new URLSearchParams();
    params.set("userId", this.opts.userId);
    if (this.opts.displayName) params.set("displayName", this.opts.displayName);
    if (this.lastSeenSeq > 0) {
      params.set("resume", String(this.lastSeenSeq));
    }
    return `${proto}//${host}/live/session/${encodeURIComponent(
      this.opts.shareID,
    )}?${params.toString()}`;
  }

  private handleFrame(raw: unknown) {
    if (typeof raw !== "string") return;
    // Any inbound frame is proof of life — cancel a pending
    // zombie-probe watchdog. We do this BEFORE parsing so a
    // malformed (but real) frame still counts as the socket
    // being alive.
    this.clearZombieProbe();
    let msg: ServerMessage;
    try {
      msg = JSON.parse(raw) as ServerMessage;
    } catch {
      return;
    }
    switch (msg.type) {
      case "hello":
        this.editLocked = msg.editLocked === true;
        this.opts.onHello?.(msg);
        // Snap the seq cursor to whatever the server says is
        // current — the replayed mutations that follow will
        // bump it forward as we process each one.
        if (typeof msg.latestSeq === "number" && msg.latestSeq > this.lastSeenSeq) {
          // We don't update lastSeenSeq from `latestSeq` directly
          // because the replay tail still needs to flow through
          // `onMutation` — only the replayed mutations should
          // advance the cursor, so the caller sees every op.
        }
        return;
      case "mutation":
        if (typeof msg.seq === "number" && msg.seq > this.lastSeenSeq) {
          this.lastSeenSeq = msg.seq;
        }
        this.opts.onMutation?.(msg);
        return;
      case "presence":
        this.opts.onPresence?.((msg as ServerPresenceMessage).peers);
        return;
      case "lockStatusChanged":
        this.editLocked = msg.editLocked === true;
        this.opts.onLockStatusChanged?.(this.editLocked);
        return;
      case "rate_limited":
        // We don't currently auto-retry rate-limited ops —
        // assignments are user-driven and infrequent. If we
        // start sending burst-y traffic (e.g. split-evenly
        // followed by reconciling singletons) wire a queue.
        return;
      case "pong":
        return;
      default:
        // Forward-compat: ignore unknown server message types
        // rather than crashing or disconnecting. The iOS
        // client does the same.
        return;
    }
  }

  private scheduleReconnect() {
    if (this.intentionallyClosed) return;
    this.transition("reconnecting");
    const delay = this.reconnectDelay;
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, MAX_RECONNECT_DELAY_MS);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private transition(next: LiveStatus) {
    if (this.status === next) return;
    this.status = next;
    this.opts.onStatus?.(next);
  }
}
