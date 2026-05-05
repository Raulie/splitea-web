import { useParams } from "@solidjs/router";
import {
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
import { createSnapshotStore } from "../lib/store";
import { LiveSession, type LiveStatus } from "../lib/socket";
import {
  getGuestDisplayName,
  getGuestUserId,
  newMutationId,
} from "../lib/identity";
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
export function ItemsView() {
  const params = useParams<{ shareID: string }>();
  const [snapshot] = createResource(
    () => params.shareID,
    (id) => fetchSnapshot(id),
  );

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
            <Loaded snapshot={snap()} shareID={params.shareID} />
          )}
        </Match>
      </Switch>
    </div>
  );
}

function Loaded(props: { snapshot: ReceiptSnapshot; shareID: string }) {
  // The store owns the live snapshot. After this point we
  // never read `props.snapshot` again — only `store.snapshot`,
  // which mutates as WebSocket frames arrive and as the user
  // taps to (un)assign items locally.
  const { store, applyMutation, applyOptimistic, setSelfUserId } =
    createSnapshotStore(props.snapshot, props.shareID);

  // Active contact — the "tap a contact, then tap their items"
  // model. Defaults to the first contact in the snapshot so
  // taps do something useful from the first frame. We don't
  // pre-select the iOS-owner's `isUserContact` here — that
  // flag identifies the share owner, not the web viewer; see
  // the `ContactsRow` doc comment about web SIWA.
  const initialActive = props.snapshot.contacts[0]?.id ?? null;
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

  /// History-driven push/pop. Pushing the summary adds a
  /// history entry with `state.view === "summary"`; the
  /// browser back button (and iOS Safari's edge-swipe
  /// gesture, which delegates to `history.back()`) fire
  /// popstate, which our listener resolves into a SPA pop
  /// animation instead of letting Safari leave Splitea.
  ///
  /// Two pop entry points share the same animation:
  ///   • `popSummary()` — what the in-app back button calls.
  ///     Just delegates to `history.back()`; the popstate
  ///     handler does the actual work.
  ///   • The popstate listener — fires on browser back AND
  ///     on `history.back()`. Inspects `e.state` to decide
  ///     push vs pop, so forward navigation re-opens the
  ///     summary correctly.
  const pushSummary = () => {
    if (pushPhase() !== "closed") return;
    setPushPhase("open");
    history.pushState({ view: "summary" }, "");
  };
  const closeSummaryAnimated = () => {
    if (pushPhase() !== "open") return;
    setPushPhase("closing");
    setTimeout(() => setPushPhase("closed"), PUSH_ANIMATION_MS);
  };
  /// User-facing pop entry point used by the in-app back
  /// button. Calls `history.back()` which fires popstate;
  /// the listener handles the actual close. Routing through
  /// history keeps the browser's navigation stack and our
  /// SPA's nav state in sync — without this, tapping the
  /// in-app back leaves a stale history entry and the next
  /// browser-back press would no-op.
  const popSummary = () => {
    if (pushPhase() !== "open") return;
    history.back();
  };
  const onPopState = (e: PopStateEvent) => {
    const wantSummary =
      (e.state as { view?: string } | null)?.view === "summary";
    const showing = pushPhase() === "open";
    if (wantSummary && !showing) {
      // Forward navigation back into the summary state
      // (e.g. user hit browser-forward after a back).
      // Skip the animation here — Safari doesn't show one
      // for popstate-driven forward nav either.
      setPushPhase("open");
    } else if (!wantSummary && showing) {
      closeSummaryAnimated();
    }
  };
  onMount(() => {
    window.addEventListener("popstate", onPopState);
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
  const session = new LiveSession({
    shareID: props.shareID,
    userId: getGuestUserId(),
    displayName: getGuestDisplayName(),
    initialResumeSeq: store.lastSeenSeq,
    onHello: (msg) => {
      setSelfUserId(msg.yourUserId);
      if (msg.resumeGap) {
        // Seq cursor was outside the relay's retained window.
        // Cleanest recovery is a hard reload — the next mount
        // re-bootstraps from `/r/<id>/snapshot` and resets
        // `lastSeenSeq`. Triggering it inline avoids stale
        // state from leaking across the boundary.
        window.location.reload();
      }
    },
    onMutation: (msg) => {
      applyMutation(msg.op, msg.seq);
    },
    onPresence: (_peers) => {
      // Presence display isn't on the page yet — Day 3 is
      // tap-to-assign only. Hook up later when we want to
      // show "Camila is also editing" tags.
    },
    onStatus: (next) => {
      setLiveStatus(next);
      clearTimers();
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
  session.open();
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
  ///   • **Everyone active** — mirror iOS `toggleAssignment`
  ///     when `isEveryoneActive`. If the item is currently
  ///     assigned to ALL contacts, remove all of them (one
  ///     `assignment.remove` per existing edge). Otherwise
  ///     add the missing edges so the end state is "every
  ///     contact assigned." We deliberately don't send
  ///     `split.evenly` / `assignments.clear` bulk ops — the
  ///     iOS-side tap-by-tap behavior is per-item, not
  ///     receipt-wide.
  const onToggleItem = (itemId: string) => {
    // Gate on liveStatus — if the WebSocket isn't open, the
    // mutation we'd send is dropped on the floor (see
    // `LiveSession.send` which silently drops when not OPEN),
    // creating local/remote divergence the next replay can't
    // resolve cleanly. Hard-no-op until we're live; the
    // `ConnectingPill` already tells the user why.
    if (liveStatus() !== "open") return;
    const active = activeContactId();
    if (!active) return;

    if (active === EVERYONE_ID) {
      const allContacts = store.snapshot.contacts;
      const currentAssignments = store.snapshot.assignments.filter(
        (a) => a.itemId === itemId,
      );
      const assignedIds = new Set(currentAssignments.map((a) => a.contactId));
      const isFullyAssigned =
        allContacts.length > 0 &&
        allContacts.every((c) => assignedIds.has(c.id));

      if (isFullyAssigned) {
        // Strip all assignees off this item.
        for (const a of currentAssignments) {
          const op: MutationOp = {
            kind: "assignment.remove",
            payload: {
              assignmentId: a.id,
              itemId: a.itemId,
              contactId: a.contactId,
            },
          };
          applyOptimistic(op);
          session.sendMutation(op);
        }
      } else {
        // Add only the missing edges.
        for (const c of allContacts) {
          if (assignedIds.has(c.id)) continue;
          const op: MutationOp = {
            kind: "assignment.add",
            payload: {
              assignmentId: newMutationId(),
              itemId,
              contactId: c.id,
            },
          };
          applyOptimistic(op);
          session.sendMutation(op);
        }
      }
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
      {/* The "page" wrapper holds ItemsView's contents. CSS
          drives the iOS-push parallax: when the summary is
          pushed on top, this page slides 25% to the left and
          dims to opacity 0.9, mirroring UIKit's
          `_UIParallaxDimmingView`. The class is applied ONLY
          in the "open" state. During "closing", removing the
          class triggers the CSS transition back from
          translate(-25%) opacity:0.9 to translate(0)
          opacity:1, animating the under-page over 400ms in
          lockstep with the pushed view's slide-out. Mirrors
          OnsenUI's `IOSSlideNavigatorAnimator.pop()`. */}
      <div
        class="ios-nav-page"
        classList={{
          "ios-nav-page-pushed": pushPhase() === "open",
        }}
      >
      {/* Body-level scroll — content is in normal flow inside
          `.ios-nav-page`, no internal `overflow-y: auto`
          wrapper. iOS 26 Safari's bottom URL bar collapses on
          scroll only when the BODY scrolls (an inner scroll
          container keeps the toolbar pinned at full size).
          With this layout, scrolling the items list scrolls
          the document, which triggers the native toolbar-
          collapse behavior. */}
      <div class="px-4 pt-6">
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

      {/* Bottom padding clears the fixed bottom bar so the
          BillSummary's last row (Total) is reachable by
          scrolling instead of being permanently pinned
          beneath the bar. Padding accounts for ~160px of bar
          height (contacts row + Continue button + their
          internal padding) plus `env(safe-area-inset-bottom)`
          for the gap between the bar's bottom edge and the
          absolute viewport bottom. */}
      <div class="px-4 mt-6 pb-[calc(160px+env(safe-area-inset-bottom))] space-y-7">
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
      </div>

      {/* Bottom chrome — contacts row + Continue. Now a SIBLING
          of `.ios-nav-page` (not a child) so it can use
          `position: fixed` against the viewport. Living inside
          the page wrapper would have re-rooted the fixed
          positioning against the transformed ancestor during
          the push animation, dragging the bar offscreen with
          the page scroll. As a sibling with the same pushed
          class applied via classList, the bar stays viewport-
          anchored at idle (so it survives body scroll + URL
          bar collapse) and gets the same translate/dim
          treatment in lockstep with the under-page during
          a push. */}
      <div
        class="ios-nav-page-bottom"
        classList={{
          "ios-nav-page-pushed": pushPhase() === "open",
        }}
      >
        <div
          class="absolute inset-0 pointer-events-none"
          style={{
            // No `backdrop-filter` (no frosted glass). We use
            // a plain linear-gradient instead, so the bar
            // composites against whatever is behind it via
            // standard alpha blending. Reason for not using
            // the frosted material here: it looked too soft
            // visually under the dark UI, and Safari's view-
            // transition snapshot machinery can't preserve
            // live `backdrop-filter` (it captures the element
            // as a flat image), which broke the look during
            // any animation that snapshotted the page.
            //
            // Gradient shape — most of the bar is solid
            // dark, with just a soft fade at the very top
            // edge so the items list doesn't terminate in
            // a hard line. The contacts row sits roughly
            // 30–60% down the bar, so the SOLID region
            // needs to start by ~20% to give the contacts
            // a properly dark backdrop for contrast.
            //
            // Distribution:
            //   • 0%–8%    solid transparent (top edge soft band)
            //   • 8%–24%   fade transparent → near-black
            //   • 24%–100% solid near-black (~76% of bar height)
            //
            // Stops at 8% and 24% only — CSS extends the
            // first/last colors to 0%/100% implicitly, so
            // the solid bands at top and bottom come for
            // free without explicit endpoint stops.
            background:
              "linear-gradient(to bottom," +
              " rgba(20,20,22,0) 8%," +
              " rgba(20,20,22,0.85) 24%)",
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
              // Same liveStatus gate as `onToggleItem` — no
              // point letting the user pick an active
              // contact if their next tap (to assign) won't
              // land. Switching the active contact alone
              // doesn't send a mutation, but allowing it
              // would paint an interactive state the user
              // can't actually use yet.
              if (liveStatus() !== "open") return;
              // Plain state set — no View Transition wrap.
              // The reorder is instantaneous; the active
              // contact's size grow/shrink animates via
              // plain CSS transitions inside `Avatar`.
              // Going through View Transitions broke the
              // bottom-bar scrim's `backdrop-filter` (the
              // browser snapshots the page during the
              // transition, and Safari's snapshot doesn't
              // composite live blur effects).
              setActiveContactId(id);
            }}
          />
        </div>
        <div class="relative px-4 pb-3 pt-1">
          <button
            type="button"
            class="w-full h-12 rounded-full bg-ios-blue text-white text-ios-headline font-semibold active:opacity-80 transition-opacity"
            onClick={() => pushSummary()}
          >
            Continue
          </button>
        </div>
      </div>

      {/* Receipt viewer overlay — only mounted when toggled on,
          so the base64 payload isn't decoded into a DOM element
          (or fed to the PDF renderer) until the user actually
          asks to see it. The component handles its own backdrop
          / Esc / scroll-lock concerns. */}
      <Show when={showingReceipt() && store.snapshot.receipt.receiptImageBase64}>
        <ReceiptViewer
          base64={store.snapshot.receipt.receiptImageBase64!}
          mimeType={store.snapshot.receipt.receiptMimeType}
          onClose={() => setShowingReceipt(false)}
        />
      </Show>

      {/* Pushed view — `SavedReceiptView` slides in from the
          right edge with the OnsenUI 400ms / cubic-bezier
          (0.3, 0.4, 0, 0.9) curve. When `pushPhase` flips to
          "closing" we keep the element mounted for the
          animation duration and only unmount once the slide-
          out completes (handled by the setTimeout in
          `closeSummaryAnimated`). The drop-shadow on its
          leading edge approximates UIKit's
          `UINavigationBar._defaultShadowImage`. */}
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
            onBack={() => popSummary()}
          />
        </div>
      </Show>
    </div>
    </>
  );
}

function LoadingState() {
  return (
    <div class="h-dvh flex items-center justify-center">
      <div class="text-ios-label-secondary text-ios-body">Loading…</div>
    </div>
  );
}

function ExpiredState() {
  return (
    <div class="h-dvh flex flex-col items-center justify-center px-6 text-center gap-4">
      {/* Splitea app icon — same `/apple-touch-icon.png` the
          splitea-live worker serves at the apex (used by
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
        Splitea share links expire after 7 days. Ask your friend to send a new one.
      </p>
    </div>
  );
}

function ErrorState() {
  return (
    <div class="h-dvh flex flex-col items-center justify-center px-6 text-center gap-4">
      <h1 class="text-ios-title-2">Couldn't load this receipt</h1>
      <p class="text-ios-body text-ios-label-secondary max-w-xs">
        Try again in a moment. If the problem persists, ask your friend to
        send a new share link.
      </p>
    </div>
  );
}
