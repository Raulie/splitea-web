import { useParams, useSearchParams } from "@solidjs/router";
import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  Match,
  onCleanup,
  onMount,
  Show,
  Switch,
} from "solid-js";
import type { ContactPayload, ReceiptSnapshot } from "../types/snapshot";
import { fetchSnapshot, ShareFetchError } from "../lib/api";
import { ReceiptInfoCard } from "../components/ReceiptInfoCard";
import { ItemsList } from "../components/ItemsList";
import { ContactsRow, EVERYONE_ID } from "../components/ContactsRow";
import { BillSummary } from "../components/BillSummary";
import { ReceiptViewer } from "../components/ReceiptViewer";
import { ConnectingPill, type ConnectingPillState } from "../components/ConnectingPill";
import { SavedReceiptView } from "./SavedReceiptView";
import { BackButton } from "../components/BackButton";
import { NavBar } from "../components/NavBar";
import { createSnapshotStore } from "../lib/store";
import { LiveSession, type LiveStatus } from "../lib/socket";
import {
  getGuestDisplayName,
  getGuestUserId,
  newMutationId,
} from "../lib/identity";
import {
  HAPTIC_LIGHT,
  HAPTIC_MEDIUM,
  triggerHaptic,
} from "../lib/haptics";
import type { MutationOp } from "../types/live";
import {
  calculateContactBreakdowns,
  totalsByContactFromBreakdowns,
} from "../lib/moneyMath";

/// Day-3 read+write render. Shape mirrors the iOS `ItemsView`
/// from the App Store preview: header chrome, receipt-info
/// card, items list, sticky bottom contacts row, Continue CTA.
///
/// Live wiring summary:
///   1. `fetchSnapshot` HTTP-bootstraps the receipt state.
///   2. `createSnapshotStore` wraps it in a Solid store so the
///      UI reactively re-renders on each apply.
///   3. `LiveSession` opens the WebSocket, replays missed
///      mutations, and streams new ones from peers.
///   4. Tap-to-assign in `ItemsList` sends `assignment.add` /
///      `assignment.remove` ops and applies optimistically.
/// Map a share-URL identifier (either the numeric `shortId`
/// from `/r/<id>/c/<shortId>` or a UUID-shaped string from the
/// legacy `?for=<UUID>` query) to the canonical contact UUID
/// used everywhere else in the view. Returns null when nothing
/// matches — the caller then renders the all-items breakdown.
/// Mirrors `splitea-shares/src/contactBreakdown.ts:resolveContactUUID`
/// so the two consumers can't disagree on what a given URL
/// points at.
function resolveForContact(
  snapshot: ReceiptSnapshot,
  raw: string | null,
): string | null {
  if (!raw) return null;
  if (/^\d+$/.test(raw)) {
    const n = Number(raw);
    if (Number.isInteger(n) && n > 0) {
      const hit = snapshot.contacts.find((c) => c.shortId === n);
      if (hit) return hit.id;
    }
  }
  const needle = raw.toLowerCase();
  for (const c of snapshot.contacts) {
    if (c.id.toLowerCase().startsWith(needle)) return c.id;
  }
  return null;
}

export function ItemsView() {
  const params = useParams<{ shareID: string; contactShortId?: string }>();
  const [searchParams] = useSearchParams<{ for?: string }>();
  const [snapshot] = createResource(
    () => params.shareID,
    (id) => fetchSnapshot(id),
  );

  // Recipient-targeted "request" link. Two forms accepted:
  //
  //   - `/r/<id>/c/<shortId>` (current nested path) — the
  //     short numeric id maps to `snapshot.contacts[].shortId`.
  //     Resolved to the canonical UUID below once the snapshot
  //     is in.
  //   - `?for=<contactUUID>` (legacy query) — still honored so
  //     in-flight share links from before the path rollout
  //     keep working.
  //
  // When either resolves to a contact, the visitor is read-
  // only: the SPA skips the WebSocket (no live edits in / out),
  // preselects that contact as the visitor's identity for the
  // Pay flow, and forces summary-first mode so the recipient
  // lands on their breakdown immediately rather than ItemsView's
  // editor.
  const forContactRaw = (): string | null =>
    params.contactShortId ?? searchParams.for ?? null;

  // Title for expired / error / loading states. The loaded state's
  // own createEffect overrides this once a snapshot is in.
  createEffect(() => {
    const err = snapshot.error;
    if (err instanceof ShareFetchError && err.kind === "expired") {
      document.title = "Splitea | Expired split";
    } else if (err) {
      document.title = "Splitea | Couldn't load split";
    } else if (snapshot.loading) {
      document.title = "Splitea";
    }
  });

  return (
    // Loading/error states need a viewport-sized container too,
    // matching the `Loaded` state's `.ios-nav-stack` (which
    // pins itself to `height: 100dvh`). Skipping a wrapping
    // flex column here — the per-state child handles its own
    // centering / padding.
    <div class="bg-ios-bg text-ios-label">
      <Switch>
        <Match when={snapshot.loading}>
          <LoadingState />
        </Match>
        <Match when={snapshot.error instanceof ShareFetchError && (snapshot.error as ShareFetchError).kind === "expired"}>
          <ExpiredState />
        </Match>
        <Match when={snapshot.error}>
          <ErrorState />
        </Match>
        <Match when={snapshot()}>
          {(snap) => (
            <Loaded
              snapshot={snap()}
              shareID={params.shareID}
              forContactId={resolveForContact(snap(), forContactRaw())}
            />
          )}
        </Match>
      </Switch>
    </div>
  );
}

function Loaded(props: {
  snapshot: ReceiptSnapshot;
  shareID: string;
  /// When non-null, this is a "Request payment" link: the
  /// recipient is read-only, the WebSocket stays closed, and
  /// the SPA jumps straight to the breakdown view with this
  /// contact preselected as the visitor's identity. Comes from
  /// `?for=<contactId>` on the URL.
  forContactId: string | null;
}) {
  const isReadOnly = () => props.forContactId !== null || store.editLocked;
  // The store owns the live snapshot. After this point we
  // never read `props.snapshot` again — only `store.snapshot`,
  // which mutates as WebSocket frames arrive and as the user
  // taps to (un)assign items locally.
  const { store, applyMutation, applyOptimistic, setSelfUserId, setEditLocked } =
    createSnapshotStore(props.snapshot, props.shareID);

  // Overrides the splitea-shares landing-HTML title
  // ("Splitea • Tap for details — Splitea") with the merchant's
  // name once the snapshot is in. Falls back to plain "Splitea"
  // when no merchant is known.
  createEffect(() => {
    const merchant = store.snapshot.receipt.merchantName?.trim();
    document.title = merchant ? `Splitea | ${merchant}` : "Splitea";
  });

  // Active contact — the "tap a contact, then tap their items"
  // model. Defaults to the first contact in the snapshot so
  // taps do something useful from the first frame. We don't
  // pre-select the iOS-owner's `isUserContact` here — that
  // flag identifies the share owner, not the web viewer; see
  // the `ContactsRow` doc comment about web SIWA.
  // Read-only Request link — preselect the recipient's
  // contact so their row highlights and the breakdown opens to
  // their share. Falls back to the first contact when the
  // `?for=<id>` value doesn't match any snapshot contact (stale
  // link, recipient was removed since the share was minted).
  const initialActive = (() => {
    if (props.forContactId) {
      const match = props.snapshot.contacts.find(
        (c) => c.id === props.forContactId,
      );
      if (match) return match.id;
    }
    return props.snapshot.contacts[0]?.id ?? null;
  })();
  const [activeContactId, setActiveContactId] = createSignal<string | null>(
    initialActive,
  );

  /// Receipt-image viewer toggle — mirrors iOS
  /// `showingReceiptViewer`. The trigger lives in
  /// `ReceiptInfoCard` (right side of the merchant row), only
  /// rendering when the snapshot ships a non-empty
  /// `receiptImageBase64`.
  const [showingReceipt, setShowingReceipt] = createSignal(false);

  /// Stack-pushed `SavedReceiptView`. Three phases drive the
  /// iOS-style slide animation, ported from OnsenUI's
  /// `IOSSlideNavigatorAnimator`:
  ///
  ///   • `"closed"` — summary unmounted, ItemsView fills the
  ///     viewport. Default at first paint.
  ///   • `"open"`   — summary mounted at viewport-right with
  ///     the `.ios-nav-pushed-in` keyframe sliding it to 0,
  ///     ItemsView gets `.ios-nav-page-pushed` applied so it
  ///     parallaxes to translateX(-25%) + opacity 0.9.
  ///   • `"closing"` — back-tap; summary slides back out via
  ///     `.ios-nav-pushed-out` while ItemsView's pushed class
  ///     is removed (transitioning back to translate(0)
  ///     opacity:1). After the 400ms animation completes we
  ///     flip state to `"closed"` and unmount.
  ///
  /// We don't unmount on close — the exit animation needs the
  /// element in the DOM for the duration. Hence the three-
  /// state machine vs. a plain boolean.
  const [pushPhase, setPushPhase] = createSignal<
    "closed" | "open" | "closing"
  >("closed");
  /// Animation duration in ms. Match the CSS in `index.css`
  /// (`.ios-nav-page` transition + `ios-nav-push-in/out`
  /// keyframes both run for 400ms). Keep in sync.
  const PUSH_ANIMATION_MS = 400;

  /// "Summary-first" entry mode. The decision is COMPUTED ONCE
  /// per mount — but NOT at construction time. Reason: at
  /// construction the only data available is the static
  /// `/r/<id>/snapshot` blob, which is frozen at share-creation
  /// time and contains zero assignments (assignments live in
  /// the WebSocket mutation log, not the snapshot). If we
  /// captured the mode at construction we'd ALWAYS see "no
  /// items assigned" and fall into items-first mode regardless
  /// of the actual current state.
  ///
  /// Instead we wait for the WebSocket to replay the mutation
  /// tail up to the relay's `latestSeq` (sent via `hello`),
  /// THEN snapshot the assignment state and lock the mode.
  /// `modeCaptured()` returns null while waiting, true for
  /// summary-first, false for items-first. Loaded() renders
  /// a brief loading placeholder while null.
  ///
  /// Locked once: a mid-session change in assignment state
  /// (an iOS user finishing the last assignment over the live
  /// channel after the page is loaded) does NOT auto-flip the
  /// mode — that would yank the UI out from under the user.
  ///
  /// 3-second timeout fallback covers slow networks where the
  /// WebSocket hasn't connected yet — we capture from whatever
  /// state we have and let live updates trickle in normally.
  const [modeCaptured, setModeCaptured] = createSignal<boolean | null>(null);
  /// `latestSeq` reported by the relay's hello; once we've
  /// applied a mutation with `seq >= helloLatestSeq` we know
  /// replay has caught up and the snapshot is current.
  let helloLatestSeq: number | null = null;
  const captureMode = () => {
    if (modeCaptured() !== null) return;
    // Request links (read-only): always summary-first. The
    // recipient came here to see their breakdown — the items
    // editor is editor-only and irrelevant to them.
    if (isReadOnly()) {
      setModeCaptured(true);
      return;
    }
    const items = store.snapshot.items;
    const all =
      items.length > 0 &&
      items.every((item) =>
        store.snapshot.assignments.some((a) => a.itemId === item.id),
      );
    setModeCaptured(all);
  };
  /// Convenience getter for the JSX. Returns false while
  /// loading (so during the brief pre-capture window the JSX
  /// can render whichever fallback it wants without hitting
  /// the null branch); the wrapping `<Show when>` on the
  /// Loaded() body gates rendering on `modeCaptured() !== null`.
  const summaryFirst = () => modeCaptured() === true;

  /// History-driven push/pop. The state machine is mode-
  /// agnostic — it just tracks whether the overlay is mounted,
  /// not which view IS the overlay (the JSX's `summaryFirst()`
  /// gate decides that):
  ///
  ///   • Items-first mode (some items still unassigned):
  ///     base = ItemsView, overlay = SavedReceiptView.
  ///     Continue button → pushSummary() → overlay slides in.
  ///     Back button → popSummary() → history.back() →
  ///     popstate fires → closeSummaryAnimated → overlay
  ///     slides out, ItemsView visible underneath.
  ///
  ///   • Summary-first mode (every item assigned at first
  ///     paint): base = SavedReceiptView, overlay = ItemsView.
  ///     Pencil button → pushSummary() → overlay slides in.
  ///     Back / Done button → popSummary() → same.
  ///
  /// Both flows go through the same `pushSummary` / `popSummary`
  /// pair and share the same popstate semantics. The history
  /// state object uses `view: "overlay"` (not "summary",
  /// which would be misleading in summary-first mode where
  /// the overlay is the items editor).
  ///
  /// Forward navigation (browser → ) after a back: popstate
  /// fires with state.view === "overlay" again → we re-set
  /// pushPhase to "open" without running the slide-in
  /// animation (Safari doesn't animate forward popstate
  /// transitions either, so this is consistent).
  const pushSummary = () => {
    if (pushPhase() !== "closed") return;
    setPushPhase("open");
    history.pushState({ view: "overlay" }, "");
  };
  const closeSummaryAnimated = () => {
    if (pushPhase() !== "open") return;
    setPushPhase("closing");
    setTimeout(() => setPushPhase("closed"), PUSH_ANIMATION_MS);
  };
  /// User-facing pop entry point used by the in-app back /
  /// Done button. Calls `history.back()` which fires
  /// popstate; the listener handles the actual close.
  /// Routing through history keeps the browser's navigation
  /// stack and our SPA's nav state in sync — without this,
  /// tapping the in-app back leaves a stale history entry
  /// and the next browser-back press would no-op.
  const popSummary = () => {
    if (pushPhase() !== "open") return;
    history.back();
  };
  const onPopState = (e: PopStateEvent) => {
    // Decide based on OUR `pushPhase` first, not on `e.state`.
    //
    // Reason: `@solidjs/router` registers its own popstate
    // listener BEFORE ours and runs `saveCurrentDepth()`
    // which can `history.replaceState` to merge a `_depth`
    // field into the current entry's state, AND can call
    // `history.go(-delta)` under certain conditions to
    // reverse a navigation it considers blocked. The reversal
    // fires a SECOND popstate, by which time `history.state`
    // is back to our pushed entry's state — so trying to
    // distinguish back-from-overlay from forward-into-overlay
    // by reading `e.state.view === "overlay"` is unreliable
    // (we observed a real failure where popstate fired with
    // `e.state = { view: "overlay", _depth: 8 }` AND
    // `pushPhase === "open"`, leaving the overlay open).
    //
    // Defensive policy:
    //   • If we're showing the overlay and ANY popstate fires
    //     → close. The user navigated, and from our point of
    //     view that means "go back".
    //   • If we're NOT showing and the popstate's state has
    //     `view: "overlay"` → forward navigation back into
    //     the overlay; reopen.
    //   • Otherwise → no-op (other route changes).
    const wantOverlay =
      (e.state as { view?: string } | null)?.view === "overlay";
    const showing = pushPhase() === "open";
    if (showing) {
      closeSummaryAnimated();
    } else if (wantOverlay) {
      // Forward navigation back into the overlay. Skip the
      // slide animation — Safari doesn't animate popstate-
      // driven forward navigation either.
      setPushPhase("open");
    }
  };
  onMount(() => {
    window.addEventListener("popstate", onPopState);
    // Read-only Request link — capture mode immediately
    // (summary-first) so we don't wait on a WebSocket that
    // never opens. Without this the modeCaptured signal would
    // sit at null until the 3-second fallback ticks.
    if (isReadOnly()) {
      captureMode();
    }
    // Safety net: if the WebSocket hasn't connected and
    // replayed within 3 seconds (slow network, blocked socket,
    // etc.), capture mode from whatever state we have so the
    // user sees SOME UI rather than an indefinite loading
    // placeholder. Live updates continue to apply normally
    // when the connection eventually comes through.
    setTimeout(() => {
      if (modeCaptured() === null) captureMode();
    }, 3000);
  });
  onCleanup(() => {
    window.removeEventListener("popstate", onPopState);
  });

  /// Live-connection status, mirrored from `LiveSession`'s
  /// `onStatus` callback. Drives both the visible
  /// `ConnectingPill` and the gate around user actions
  /// (taps no-op when the WebSocket isn't open, so the user
  /// can't make changes that silently fall on the floor).
  const [liveStatus, setLiveStatus] = createSignal<LiveStatus>("connecting");

  /// Pill display state — strictly a function of liveStatus
  /// EXCEPT that "open" doesn't immediately hide the pill;
  /// we briefly flash a green "Connected" confirmation for
  /// 800ms so the user sees the resolution rather than the
  /// pill silently disappearing.
  const [pillState, setPillState] = createSignal<ConnectingPillState>("connecting");
  let connectedFlashTimer: ReturnType<typeof setTimeout> | null = null;
  /// Tracks how long we've been in a non-open state so we
  /// can promote the pill to "Offline" after a meaningful
  /// stretch (the user has waited long enough to deserve
  /// the firmer status word).
  let offlineEscalationTimer: ReturnType<typeof setTimeout> | null = null;
  const OFFLINE_ESCALATION_MS = 10_000;

  const clearTimers = () => {
    if (connectedFlashTimer !== null) {
      clearTimeout(connectedFlashTimer);
      connectedFlashTimer = null;
    }
    if (offlineEscalationTimer !== null) {
      clearTimeout(offlineEscalationTimer);
      offlineEscalationTimer = null;
    }
  };

  // WebSocket lifecycle. Opens on mount, closes on unmount.
  // The session refetches snapshot on `resumeGap: true` because
  // the relay's log no longer covers our seq cursor — we'd
  // otherwise apply mutations on top of a stale base.
  //
  // The cursor starts at the snapshot's own `snapshotSeq`
  // watermark, so a gap on a FRESH mount means the log was
  // trimmed past the watermark — reloading would re-fetch the
  // same snapshot and gap again forever. In that case accept the
  // relay's full-log replay on top of the snapshot (idempotent /
  // LWW appliers converge) and only hard-reload when the cursor
  // has advanced past the seeded value, i.e. a genuinely stale
  // long-lived session.
  // Recipient Request links open the socket RECEIVE-ONLY: they
  // stream settlement / edit broadcasts into `store.snapshot` (so
  // the breakdown and Pay sheet reflect an owner's confirmation
  // live, without a reload) but never send an op — see
  // `receiveOnly` on LiveSession. Non-recipient viewers connect
  // as normal read/write peers.
  const receiveOnly = props.forContactId !== null;
  const seededResumeSeq = store.lastSeenSeq;
  const session = new LiveSession({
    shareID: props.shareID,
    userId: getGuestUserId(),
    displayName: getGuestDisplayName(),
    initialResumeSeq: store.lastSeenSeq,
    receiveOnly,
    onHello: (msg) => {
      setSelfUserId(msg.yourUserId);
      setEditLocked(msg.editLocked === true);
      if (msg.resumeGap && store.lastSeenSeq > seededResumeSeq) {
        window.location.reload();
      }
      // Note the relay's current high-water seq so we know
      // when replay has caught up. If the relay has zero
      // mutations to replay (`latestSeq === 0`), there's no
      // tail to wait for and we can capture mode immediately.
      helloLatestSeq = msg.latestSeq ?? 0;
      if (helloLatestSeq === 0 || store.lastSeenSeq >= helloLatestSeq) {
        captureMode();
      }
    },
    onMutation: (msg) => {
      applyMutation(msg.op, msg.seq);
      // Replay has caught up to the latestSeq the relay
      // reported in `hello`. Snapshot is now current —
      // capture summary-first mode. Subsequent live edits
      // continue flowing; the captured mode stays locked.
      if (
        helloLatestSeq !== null &&
        msg.seq >= helloLatestSeq &&
        modeCaptured() === null
      ) {
        captureMode();
      }
    },
    onPresence: (_peers) => {
      // Presence display isn't on the page yet — Day 3 is
      // tap-to-assign only. Hook up later when we want to
      // show "Camila is also editing" tags.
    },
    onLockStatusChanged: (locked) => {
      setEditLocked(locked);
    },
    onStatus: (next) => {
      setLiveStatus(next);
      clearTimers();
      // Recipient links keep the live connection invisible — no
      // "Connecting…"/"Connected" pill for a read-only viewer.
      if (receiveOnly) {
        setPillState("hidden");
        return;
      }
      if (next === "open") {
        // Flash the green "Connected" confirmation, then
        // hide the pill once the user has had a chance to
        // register it.
        setPillState("connected");
        connectedFlashTimer = setTimeout(() => {
          setPillState("hidden");
          connectedFlashTimer = null;
        }, 800);
      } else if (next === "connecting") {
        setPillState("connecting");
        // Promote to "Offline" after a long-enough wait —
        // gives the user a stronger signal that something's
        // genuinely wrong vs. just slow.
        offlineEscalationTimer = setTimeout(() => {
          setPillState("offline");
          offlineEscalationTimer = null;
        }, OFFLINE_ESCALATION_MS);
      } else if (next === "reconnecting") {
        setPillState("reconnecting");
        offlineEscalationTimer = setTimeout(() => {
          setPillState("offline");
          offlineEscalationTimer = null;
        }, OFFLINE_ESCALATION_MS);
      } else if (next === "closed") {
        setPillState("hidden");
      }
    },
  });
  // Always open. Recipient Request links connect receive-only
  // (see `receiveOnly`): they can't land edits (the relay forwards
  // ops from any peer with the shareID, but `sendMutation` no-ops
  // for them), and their breakdown + Pay sheet now reflect an
  // owner's settlement confirmation live instead of only on
  // reload. The ConnectingPill stays hidden for them via the
  // `onStatus` guard above and the explicit set below.
  session.open();
  if (receiveOnly) {
    setPillState("hidden");
  }
  onCleanup(() => {
    clearTimers();
    session.close();
  });

  // MARK: - Derived views

  /// Index assignments by item id once for fast per-row lookup.
  /// Recomputes on every store mutation — Solid tracks reads of
  /// `store.snapshot.assignments` and `.contacts` and reruns
  /// only when those change.
  const assignmentsByItem = createMemo(() => {
    const contactsById = new Map(
      store.snapshot.contacts.map((c) => [c.id, c]),
    );
    const map = new Map<string, ContactPayload[]>();
    for (const a of store.snapshot.assignments) {
      const contact = contactsById.get(a.contactId);
      if (!contact) continue;
      const list = map.get(a.itemId) ?? [];
      list.push(contact);
      map.set(a.itemId, list);
    }
    return map;
  });

  /// Per-contact totals — verbatim port of iOS
  /// `BillCalculationService.calculateContactBreakdowns`.
  /// The math has two non-obvious invariants surfaced in the
  /// `lib/moneyMath` doc comment: (1) each item's per-contact
  /// share is rounded BEFORE summing into a contact total
  /// (avoids penny-distribution drift), and (2) tip is
  /// allocated by the contact's pre-tip subtotal share, not
  /// by subtotal+tax. Both replicated here.
  const totalsByContact = createMemo(() => {
    // Build a `Map<itemId, contactId[]>` from the existing
    // `assignmentsByItem` (which carries full `ContactPayload`
    // objects for the avatar UI). The iOS calc only needs ids.
    const idsByItem = new Map<string, string[]>();
    for (const [itemId, contacts] of assignmentsByItem()) {
      idsByItem.set(
        itemId,
        contacts.map((c) => c.id),
      );
    }
    const breakdowns = calculateContactBreakdowns(
      store.snapshot.items,
      idsByItem,
      store.snapshot.receipt,
    );
    return totalsByContactFromBreakdowns(breakdowns);
  });

  // MARK: - Tap handlers

  /// Toggle the assignment of `itemId` against the active
  /// selection. Two paths:
  ///
  ///   • **Single contact active** — flip the (item, contact)
  ///     edge. If already present, send `assignment.remove`;
  ///     if absent, send `assignment.add`. Optimistic: apply
  ///     locally before the relay echoes, so the UI doesn't
  ///     wait on the round-trip.
  ///
  ///   • **Everyone active** — mirror iOS `setItemAssignments`:
  ///     one atomic `item.assignSet` op carrying the full
  ///     desired post-state for this item (every contact, or an
  ///     empty list to clear when it's already fully assigned).
  ///     Single op, so it lands as one optimistic write and the
  ///     row jumps straight to the everyone badge — a bulk
  ///     action, not N avatars filling in one at a time.
  const onToggleItem = (itemId: string) => {
    // Gate on liveStatus — if the WebSocket isn't open, the
    // mutation we'd send is dropped on the floor (see
    // `LiveSession.send` which silently drops when not OPEN),
    // creating local/remote divergence the next replay can't
    // resolve cleanly. Hard-no-op until we're live; the
    // `ConnectingPill` already tells the user why.
    if (liveStatus() !== "open") return;
    // Gate on the owner's edit lock — same reasoning. Without
    // this, the optimistic update flashes but the server drops
    // the broadcast (relay enforces `editLocked`), so the edit
    // visually succeeds and then vanishes on reload.
    if (store.editLocked) return;
    const active = activeContactId();
    if (!active) return;
    // Selection-style haptic on item tap — matches iOS's
    // `UIImpactFeedbackGenerator(style: .light)` on the same
    // gesture. Fired AFTER the connection gate so we don't
    // pretend an action landed when it was dropped.
    triggerHaptic(HAPTIC_LIGHT);

    if (active === EVERYONE_ID) {
      const allContacts = store.snapshot.contacts;
      const assignedIds = new Set(
        store.snapshot.assignments
          .filter((a) => a.itemId === itemId)
          .map((a) => a.contactId),
      );
      const isFullyAssigned =
        allContacts.length > 0 &&
        allContacts.every((c) => assignedIds.has(c.id));

      // Atomic bulk toggle — mirror iOS `setItemAssignments`: one
      // `item.assignSet` carrying the full desired post-state
      // (everyone, or empty to clear) rather than N individual
      // assignment.add/.remove ops. A single op = a single
      // optimistic store write = one re-render, so the row snaps
      // straight to the `person.3.fill` everyone badge instead of
      // avatars filling in one-by-one. Also the on-wire shape iOS
      // ships for the same gesture, so peers converge identically.
      const op: MutationOp = {
        kind: "item.assignSet",
        payload: {
          itemId,
          contactIds: isFullyAssigned ? [] : allContacts.map((c) => c.id),
        },
      };
      applyOptimistic(op);
      session.sendMutation(op);
      return;
    }

    // Single-contact path.
    const contactId = active;
    const existing = store.snapshot.assignments.find(
      (a) => a.itemId === itemId && a.contactId === contactId,
    );
    if (existing) {
      const op: MutationOp = {
        kind: "assignment.remove",
        payload: { assignmentId: existing.id, itemId, contactId },
      };
      applyOptimistic(op);
      session.sendMutation(op);
    } else {
      const op: MutationOp = {
        kind: "assignment.add",
        payload: { assignmentId: newMutationId(), itemId, contactId },
      };
      applyOptimistic(op);
      session.sendMutation(op);
    }
  };

  /// JSX builder for the items-editor body (header +
  /// instructions + ReceiptInfoCard + ItemsList + BillSummary).
  /// Used by both the base and overlay variants of ItemsView.
  /// `showHeaderNavBar` adds a nav bar with a back button at
  /// the top — used only when the editor is the OVERLAY
  /// (summary-first mode), so the user has a way to pop back
  /// to SavedReceiptView. In items-first mode the editor is
  /// the root, so no nav bar is needed.
  const editorBody = (showHeaderNavBar: boolean) => (
    <>
      <Show when={showHeaderNavBar}>
        <NavBar
          title="Edit Items"
          leading={<BackButton onClick={() => popSummary()} />}
        />
      </Show>
      <div class="safe-px pt-6">
        <h1 class="text-ios-title-3 text-ios-label">Assign Items</h1>
        {/* `text-ios-subheadline` (15pt) matches iOS
            `.subheadline` — the font size `ItemsView.swift`
            uses for the same instructions line. The
            previous `text-ios-body` (17pt) read too large
            and competed visually with the title. */}
        <p class="text-ios-subheadline text-ios-label-secondary mt-1">
          Tap a contact, then tap their items to assign them.
        </p>
      </div>

      {/* Bottom padding clears the fixed bottom bar's SOLID
          region so the BillSummary's last row (Total) sits
          comfortably above the chrome at rest. Same approach
          as SavedReceiptView's Pay bar: the top 40px of the
          bar is intentional fade-behind territory, and content
          may scroll into the gradient on user-driven scroll —
          but at rest the last row should have breathing room
          above the solid region.

          Math: ContactsRow (~80) + Continue container (~64) +
          ~36px slack + env(safe-area-inset-bottom). The 40px
          gradient zone is NOT included — it's intentionally
          fade-behind territory on scroll. */}
      <div class="safe-px mt-6 pb-[calc(180px+env(safe-area-inset-bottom))] space-y-7">
        <ReceiptInfoCard
          merchantName={store.snapshot.receipt.merchantName}
          receiptDate={store.snapshot.receipt.receiptDate}
          hasReceiptImage={!!store.snapshot.receipt.receiptImageBase64}
          onOpenReceipt={() => setShowingReceipt(true)}
        />
        <ItemsList
          items={store.snapshot.items}
          assignmentsByItem={assignmentsByItem()}
          totalContactCount={store.snapshot.contacts.length}
          currencyCode={store.snapshot.receipt.currencyCode}
          activeContactId={activeContactId()}
          onToggleItem={onToggleItem}
        />
        {/* Subtotal / Tax / Tip / Total card. iOS calculation
            verbatim — see `lib/moneyMath.ts` for the eight
            rounding strategies the per-receipt parser detects
            and persists onto `taxRoundingMethod`. */}
        <BillSummary
          receipt={store.snapshot.receipt}
          items={store.snapshot.items}
        />
      </div>
    </>
  );

  /// JSX builder for the bottom bar (contacts row + Continue
  /// button). The Continue action depends on which view is the
  /// root: in items-first mode it pushes SavedReceiptView; in
  /// summary-first mode (where ItemsView is the overlay) it
  /// pops back to the SavedReceiptView base. Either way the
  /// state-machine transition is the same shape (closed ↔
  /// open), so we just wire onClick to whichever helper makes
  /// sense for the active mode.
  const bottomBar = () => (
    // iOS 26 Liquid Glass bottom bar — same approach as
    // SavedReceiptView's Pay bar:
    //
    //   • 40px `pt-[40px]` reserves a fade-in zone ABOVE the
    //     content (ContactsRow + Continue button) so scrolled
    //     items pass behind the chrome with a smooth
    //     transparent → frosted-black ramp instead of cutting
    //     off at a hard edge.
    //   • Solid `rgba(0,0,0,0.92)` background +
    //     `backdrop-filter: blur(20px) saturate(180%)` for the
    //     iOS 26 frost.
    //   • `mask-image: linear-gradient(transparent → black)`
    //     fades the ENTIRE element including the
    //     backdrop-filtered region. CSS `backdrop-filter`
    //     can't accept a gradient on its own, so a plain
    //     transparent-at-top color gradient still left a hard
    //     blur boundary; the mask handles both color and blur
    //     in one stroke.
    //   • Mask: transparent at the top, ramping to fully
    //     opaque by 50% of the bar height. The fade ends
    //     near the middle of ContactsRow, so the row's top
    //     edge has some item-show-through (gives a sense of
    //     depth — items scrolling underneath the chrome) and
    //     the bottom half / Continue button sit on solid
    //     frosted-black backing for legibility. Gradient is
    //     on the top 50%; the bottom 50% is implicit black
    //     (opaque).
    <div class="relative pt-[40px]">
      <div
        class="absolute inset-0 pointer-events-none"
        style={{
          background: "var(--ios-scrim)",
          "backdrop-filter": "blur(20px) saturate(180%)",
          "-webkit-backdrop-filter": "blur(20px) saturate(180%)",
          "mask-image":
            "linear-gradient(to bottom, transparent 0%, black 50%)",
          "-webkit-mask-image":
            "linear-gradient(to bottom, transparent 0%, black 50%)",
        }}
        aria-hidden="true"
      />
      <div class="relative">
        <ContactsRow
          contacts={store.snapshot.contacts}
          totalsByContact={totalsByContact()}
          currencyCode={store.snapshot.receipt.currencyCode}
          payerPhoneNumber={store.snapshot.receipt.payerPhoneNumber}
          activeContactId={activeContactId()}
          onSelectContact={(id) => {
            if (liveStatus() !== "open") return;
            setActiveContactId(id);
          }}
        />
      </div>
      <div class="relative safe-px pb-3 pt-1">
        <button
          type="button"
          class="w-full h-12 rounded-full bg-ios-blue text-white text-ios-headline font-semibold active:opacity-80 transition-opacity"
          onClick={() => {
            // Medium-impact haptic on the primary submit
            // action — distinguishes the "commit" feel from
            // the lighter selection haptic on item taps.
            triggerHaptic(HAPTIC_MEDIUM);
            // In items-first: push to summary. In summary-
            // first (where the editor IS the overlay): the
            // summary is already underneath, so Continue
            // means "I'm done editing" → pop back to it.
            if (summaryFirst()) popSummary();
            else pushSummary();
          }}
        >
          {summaryFirst() ? "Done" : "Continue"}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Connection-status pill — sibling of `.ios-nav-stack`
          (NOT a child) so its `position: fixed` stays anchored
          to the viewport even while the stack's children
          have `transform` applied during the iOS-style push
          animation. A transformed ancestor would otherwise
          re-root the pill against the moving page. */}
      <ConnectingPill state={pillState()} />
      <div class="ios-nav-stack">
        {/* Hold rendering until WebSocket replay catches up
            and we can decide which mode to show. Without this
            gate the JSX would render the items-first fallback
            on the first paint (because `modeCaptured()` is
            null and `summaryFirst()` returns false), then
            flip to summary-first a few hundred ms later when
            replay completes — visible flicker. The
            `LoadingState` here is the same minimal centered
            "Loading…" the route component shows while the
            HTTP snapshot fetch is in flight. */}
        <Show when={modeCaptured() !== null} fallback={<LoadingState />}>
        <Show
          when={summaryFirst()}
          fallback={
            // Items-first (original flow): ItemsView is the
            // root in `.ios-nav-page` body flow; the bottom
            // bar is a sibling pinned to the viewport;
            // SavedReceiptView slides in as overlay when the
            // user taps Continue.
            <>
              <div
                class="ios-nav-page"
                classList={{
                  "ios-nav-page-pushed": pushPhase() === "open",
                }}
              >
                {editorBody(false)}
              </div>
              <div
                class="ios-nav-page-bottom"
                classList={{
                  "ios-nav-page-pushed": pushPhase() === "open",
                }}
              >
                {bottomBar()}
              </div>
              <Show when={pushPhase() !== "closed"}>
                <div
                  class="ios-nav-pushed"
                  classList={{
                    "ios-nav-pushed-in": pushPhase() === "open",
                    "ios-nav-pushed-out": pushPhase() === "closing",
                  }}
                >
                  <SavedReceiptView
                    snapshot={store.snapshot}
                    shareID={props.shareID}
                    onBack={() => popSummary()}
                    forContactId={props.forContactId}
                  />
                </div>
              </Show>
            </>
          }
        >
          {/* Summary-first: SavedReceiptView is the ROOT in
              `.ios-nav-page` body flow with no back button —
              nothing behind it on the navigation stack. The
              pencil button on its trailing edge pushes the
              ItemsView editor onto the stack as overlay. */}
          <div
            class="ios-nav-page"
            classList={{
              "ios-nav-page-pushed": pushPhase() === "open",
            }}
          >
            <SavedReceiptView
              snapshot={store.snapshot}
              shareID={props.shareID}
              // Hide the pencil-edit affordance when the
              // visitor is on a read-only Request link — they
              // can't push to the items editor either way
              // (no live channel, no mutation path), and the
              // button would just lead to a static editor
              // they can't use.
              onEdit={isReadOnly() ? undefined : () => pushSummary()}
              forContactId={props.forContactId}
            />
          </div>
          <Show when={pushPhase() !== "closed"}>
            <div
              class="ios-nav-pushed"
              classList={{
                "ios-nav-pushed-in": pushPhase() === "open",
                "ios-nav-pushed-out": pushPhase() === "closing",
              }}
            >
              {/* Internal scroll container for the overlay's
                  body content. `.ios-nav-pushed` itself is
                  `position: fixed; top:0; bottom:0` (viewport-
                  pinned) and not a scroller — without this
                  inner wrapper the editor's content (NavBar,
                  header, items list, BillSummary, the
                  `pb-[calc(160px+env-inset)]`) would render
                  past the overlay's bottom edge with no way
                  to reach it. `absolute inset-0` fills the
                  overlay; `overflow-y-auto` makes the body
                  scroll within. The bottom bar below stays
                  outside this scroller and remains pinned
                  via its own `position: fixed` (anchored to
                  `.ios-nav-pushed` because `will-change:
                  transform` makes the overlay a containing
                  block for fixed descendants). */}
              <div class="absolute inset-0 overflow-y-auto">
                {editorBody(true)}
              </div>
              {/* Bottom bar lives INSIDE the overlay so it
                  slides in/out with the editor as one unit.
                  `.ios-nav-pushed` has `will-change: transform`
                  which creates a containing block for fixed-
                  position descendants — so the bar's
                  `position: fixed` resolves against the
                  overlay's bounds, keeping it column-pinned
                  alongside the editor body. */}
              <div class="ios-nav-page-bottom">{bottomBar()}</div>
            </div>
          </Show>
        </Show>
        </Show>

        {/* Receipt viewer overlay — only mounted when toggled on,
            so the base64 payload isn't decoded into a DOM element
            (or fed to the PDF renderer) until the user actually
            asks to see it. The component handles its own backdrop
            / Esc / scroll-lock concerns. */}
        <Show when={showingReceipt() && store.snapshot.receipt.receiptImageBase64}>
          <ReceiptViewer
            base64={store.snapshot.receipt.receiptImageBase64!}
            mimeType={store.snapshot.receipt.receiptMimeType}
            merchantName={store.snapshot.receipt.merchantName}
            receiptDateMs={store.snapshot.receipt.receiptDate}
            onClose={() => setShowingReceipt(false)}
          />
        </Show>
      </div>
    </>
  );
}

function LoadingState() {
  return (
    <div class="min-h-dvh flex items-center justify-center pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div class="text-ios-label-secondary text-ios-body">Loading…</div>
    </div>
  );
}

function ExpiredState() {
  return (
    <div class="min-h-dvh flex flex-col items-center justify-center px-6 text-center gap-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      {/* Splitea app icon — same `/apple-touch-icon.png` the
          splitea-shares worker serves at the apex (used by
          iMessage rich previews and the iOS home-screen Web
          Clip). Sized to 96pt and rounded to iOS 26's
          22.37%-of-side "squircle" radius (Apple's published
          continuous-corner ratio for app icons). */}
      <img
        src="/apple-touch-icon.png"
        alt=""
        aria-hidden="true"
        width={96}
        height={96}
        class="w-24 h-24 rounded-[22.37%]"
      />
      <h1 class="text-ios-title-2">This link has expired</h1>
      <p class="text-ios-body text-ios-label-secondary max-w-xs">
        Splitea share links expire after 7 days. Ask your friend to send a new one — or get Splitea to create your own.
      </p>
      {/*
        App Store CTA on the expired state. Earlier this was
        intentionally suppressed ("don't push App Store for a
        dead link they can't act on anyway"), but the dead-
        link case is exactly when the conversion ask makes
        sense — the recipient is here, they care about the
        receipt, and the message body told them to "open the
        receipt to pay" but the link's gone. Asking them to
        get Splitea so the next link works is a reasonable
        nudge rather than a misdirection.

        Same visual as `NotFound`'s button so the two
        states feel consistent. Real Apple ID
        (`id6760237781`) — once Splitea ships publicly,
        tapping this lands on the live App Store page. While
        it's TestFlight-only, the page may show "App not
        available", which is acceptable: the user clearly
        sees what they tapped and that the app exists.
      */}
      <a
        class="mt-4 px-6 py-3 rounded-full bg-ios-blue text-white font-semibold no-underline"
        href="https://apps.apple.com/app/splitea/id6760237781"
      >
        Get Splitea
      </a>
    </div>
  );
}

function ErrorState() {
  return (
    <div class="min-h-dvh flex flex-col items-center justify-center px-6 text-center gap-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <h1 class="text-ios-title-2">Couldn't load this receipt</h1>
      <p class="text-ios-body text-ios-label-secondary max-w-xs">
        Try again in a moment. If the problem persists, ask your friend to
        send a new share link.
      </p>
    </div>
  );
}
