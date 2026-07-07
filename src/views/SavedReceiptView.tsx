import { createSignal, For, Show, onMount, onCleanup } from "solid-js";
import type { ReceiptSnapshot } from "../types/snapshot";
import { ContactBreakdownRow } from "../components/ContactBreakdownRow";
import { BillSummary } from "../components/BillSummary";
import { UnassignedItemsSection } from "../components/UnassignedItemsSection";
import { BackButton } from "../components/BackButton";
import { EditButton } from "../components/EditButton";
import { NavBar } from "../components/NavBar";
import { ReceiptViewer } from "../components/ReceiptViewer";
import { PayMenuSheet } from "../components/PayMenuSheet";
import { IOSAlert } from "../components/IOSAlert";
import {
  calculateContactBreakdowns,
} from "../lib/moneyMath";
import { formatReceiptDateTime } from "../lib/format";
import { configuredPayProviders } from "../lib/payProviders";
import { claimPaid } from "../lib/api";
import { settlementState } from "../lib/settlement";

/// Web port of iOS `SavedReceiptDetailView`. Day-3 scope is
/// the read-only summary surface: per-contact breakdown rows
/// (avatar + name + total + payer indicator) and the same
/// `BillSummary` card we render on `ItemsView`. iOS-side
/// extras like the receipt thumbnail, edit toolbar, share
/// sheet, payment requests, and per-row expansion can land
/// in follow-ups — they're not on the web visitor's
/// permission boundary anyway.
export interface SavedReceiptViewProps {
  snapshot: ReceiptSnapshot;
  /// The share's URL id (e.g. `GFhGNmMwmH`) — the capability token
  /// the relay DO is keyed by. REQUIRED for `claimPaid`: the claim
  /// endpoint is `/live/receipt/<shareID>/claim`, NOT the receipt's
  /// internal UUID (`snapshot.receipt.id`). Passing the receipt UUID
  /// hits a nonexistent DO and 404s, so a web "Mark as paid" silently
  /// never reaches the owner.
  shareID: string;
  /// Called when the user taps the back chevron in the nav
  /// bar. Parent owns the stack-pop animation and the
  /// associated CSS state — see `ItemsView`. Optional: when
  /// omitted, the nav bar renders no leading button (used in
  /// "summary-first" mode where SavedReceiptView IS the root
  /// of the navigation stack and there's nothing behind it
  /// to go back to).
  onBack?: () => void;
  /// Optional pencil-tap handler. When provided, the nav bar
  /// renders a trailing edit button (the SF Symbol pencil,
  /// 44×44 circular). Used in the "summary-first" entry mode
  /// where the breakdown is the root view and the pencil
  /// pushes the items editor onto the stack.
  onEdit?: () => void;
  /// Recipient-targeted Request link — when set, PayMenuSheet
  /// uses this contactId as the visitor's preselected
  /// identity (skipping the "which one are you?" picker) and
  /// the breakdown UI auto-expands the matching row.
  forContactId?: string | null;
}

export function SavedReceiptView(props: SavedReceiptViewProps) {
  /// Build a `Map<itemId, contactId[]>` once per render. The
  /// `calculateContactBreakdowns` helper expects this shape
  /// (the on-snapshot assignments are a flat array).
  const contactsById = () =>
    new Map(props.snapshot.contacts.map((c) => [c.id, c]));

  const idsByItem = () => {
    const map = new Map<string, string[]>();
    for (const a of props.snapshot.assignments) {
      const list = map.get(a.itemId) ?? [];
      list.push(a.contactId);
      map.set(a.itemId, list);
    }
    return map;
  };

  /// Sort by total descending — same `lhs.total > rhs.total`
  /// rule iOS uses in `BillCalculationService.swift:62-64`,
  /// with id as the tie-breaker so the order is stable.
  const breakdowns = () => {
    const all = calculateContactBreakdowns(
      props.snapshot.items,
      idsByItem(),
      props.snapshot.receipt,
    );
    return all
      .map((b) => ({
        breakdown: b,
        total: b.subtotal + b.tax + b.tip,
        contact: contactsById().get(b.contactId),
      }))
      .filter((row) => !!row.contact)
      .sort((lhs, rhs) => {
        if (lhs.total !== rhs.total) return rhs.total - lhs.total;
        return lhs.breakdown.contactId.localeCompare(rhs.breakdown.contactId);
      });
  };

  /// Items with no contact assignment. Used to surface the
  /// `UnassignedItemsSection` callout on the breakdown so the
  /// reader sees that the displayed totals don't account for
  /// these line items (matches iOS `SplitSummaryView`'s
  /// `if !unassignedItems.isEmpty` gate). Driven off the same
  /// `idsByItem()` map the breakdowns use, so a contact
  /// assigned via WebSocket flips an item out of "unassigned"
  /// reactively.
  const unassignedItems = () => {
    const byItem = idsByItem();
    return props.snapshot.items.filter(
      (item) => (byItem.get(item.id)?.length ?? 0) === 0,
    );
  };

  /// Match payer by phone-number suffix — same heuristic
  /// `ContactsRow.tsx` uses (handles country-code drift).
  const payerPhone = () => props.snapshot.receipt.payerPhoneNumber;
  const isPayer = (phoneNumber: string) => {
    const target = payerPhone();
    if (!target) return false;
    const a = phoneNumber.replace(/\D/g, "");
    const b = target.replace(/\D/g, "");
    if (!a || !b) return false;
    return a.endsWith(b) || b.endsWith(a);
  };

  /// Per-contact expansion state. Holds the set of contact
  /// IDs whose disclosure body is currently open.
  ///
  /// We deliberately hoist EVERY row's open state into this
  /// parent, fully controlling each `ContactBreakdownRow`'s
  /// `open` prop, instead of mixing controlled (when "Expand
  /// All" is on) and uncontrolled (when off) modes. The mixed
  /// approach we shipped first had a state-tearing bug: if
  /// the user expanded one row, then tapped global Expand
  /// (controlled-on, all open), then tapped a single row to
  /// close — global flipped off, rows went uncontrolled, and
  /// the disclosure groups fell back to their stale internal
  /// state which had never been updated while controlled,
  /// snapping every other row shut along with the one the
  /// user actually wanted to close.
  ///
  /// Now: every row is always controlled. Single-row taps
  /// add / remove that one ID; the header "Expand / Collapse"
  /// button fills or clears the set.
  ///
  /// Seeded with `forContactId` when present — a recipient
  /// landing via a Request link (`?for=<contactId>`) wants
  /// to see THEIR breakdown straight away, not have to hunt
  /// for it and tap to expand. Matches the iOS deep-link
  /// behavior.
  const [expanded, setExpanded] = createSignal(
    new Set<string>(props.forContactId ? [props.forContactId] : []),
  );

  const isRowExpanded = (contactId: string) => expanded().has(contactId);
  const setRowExpanded = (contactId: string, next: boolean) => {
    const copy = new Set(expanded());
    if (next) copy.add(contactId);
    else copy.delete(contactId);
    setExpanded(copy);
  };

  /// True only when every breakdown row is currently open.
  /// Drives the header button's label ("Collapse" when fully
  /// expanded, "Expand" otherwise) and the toggle action
  /// (clear vs. fill the set).
  const allExpanded = () => {
    const rows = breakdowns();
    if (rows.length === 0) return false;
    const exp = expanded();
    return rows.every((r) => exp.has(r.breakdown.contactId));
  };

  const toggleAll = () => {
    if (allExpanded()) {
      setExpanded(new Set<string>());
    } else {
      setExpanded(new Set(breakdowns().map((r) => r.breakdown.contactId)));
    }
  };

  /// Receipt-image fullscreen toggle. Mirrors iOS
  /// `showingFullImage` — tapping the thumbnail in the
  /// receipt-image section pushes the `ReceiptViewer` modal
  /// (same component the merchant-row icon button uses on
  /// `ItemsView`).
  const [showingReceipt, setShowingReceipt] = createSignal(false);
  const [showingPayMenu, setShowingPayMenu] = createSignal(false);

  /// The contact who fronted the bill. Recipients pay them
  /// back regardless of who actually sent the share link —
  /// "Send" flow lets a non-payer forward a Splitea link, and
  /// the Pay bar still has to point at the person who's owed
  /// money (the payer), not the messenger.
  const payerContact = () =>
    props.snapshot.contacts.find((c) => isPayer(c.phoneNumber));

  /// Provider rows that will populate the Pay modal. The Pay
  /// bar gates on a non-empty list — the iOS author broadcasts
  /// the payer's `paymentUsernames` in the snapshot precisely
  /// so this works for non-Splitea-user payers (the author's
  /// device looked them up via local CNSocialProfile entries
  /// or the splitea-id directory). Older snapshots from before
  /// that change land here with `paymentUsernames: undefined`
  /// for non-self payers — the bar then hides gracefully.
  const payerProviders = () =>
    configuredPayProviders(payerContact()?.paymentUsernames);

  const payerDisplayName = () =>
    payerContact()?.fullName?.trim() || "the payer";

  /// Compatibility alias — many existing call sites use
  /// `senderDisplayName` for the Pay button label ("Pay
  /// {Name}"), but the recipient is actually paying the
  /// payer. Re-routing here keeps every Pay-bar copy
  /// pointing at the right person without fanning out
  /// renames across the file.
  const senderDisplayName = () => payerDisplayName();

  /// Non-payer contacts the visitor might be — the modal's
  /// identity-picker first stage offers these as choices.
  /// Each entry carries the contact's pre-computed share
  /// total so the amount-prefilled payment URL can be built
  /// without re-running breakdown math inside the sheet.
  ///
  /// Excludes the payer (who isn't paying themselves) and
  /// any zero-share contacts (assignment-less guests who
  /// owe nothing — no point listing someone with $0 in the
  /// "who are you" picker since paying $0 isn't a workflow).
  const payCandidates = () =>
    breakdowns()
      .filter(
        (row) =>
          row.contact !== undefined &&
          !isPayer(row.contact.phoneNumber) &&
          row.total > 0,
      )
      .map((row) => ({
        contactId: row.breakdown.contactId,
        displayName: row.contact!.fullName?.trim() || "Someone",
        amount: row.total,
        avatarUrl: row.contact!.avatarUrl ?? null,
        settlementState: settlementState(row.contact!),
      }));

  /// Whether the "Pay {payer}" button should render. Requires
  /// BOTH the payer having a configured provider AND at least
  /// one non-payer debtor to pay for. Without a candidate the
  /// PayMenuSheet's identity picker has zero rows and the flow
  /// dead-ends (the visitor can never reach the provider stage),
  /// so a payer-only-assignment receipt would otherwise present
  /// a Pay button that does nothing when tapped.
  const canPay = () => payerProviders().length > 0 && payCandidates().length > 0;

  /// Marks the given contact as paid — the recipient's claim (they
  /// paid; the payer confirms later). Wired to the "Mark as paid"
  /// row at the bottom of the `PayMenuSheet`, mirroring the iOS Pay
  /// menu. Fire-and-forget: the sheet flips its own UI
  /// optimistically and the snapshot's live sync reflects the claim
  /// in the breakdown rows. Idempotent server-side, so a transient
  /// failure is safely retriable on the next tap.
  const onMarkPaid = (contactId: string) => {
    void claimPaid(props.shareID, contactId).catch(() => {});
  };

  /// "Did you pay <payer>?" return prompt — the web analog of iOS's
  /// scenePhase confirm in `BreakdownSectionsView`. When a still-owing
  /// visitor taps a provider we stash an armed record in sessionStorage
  /// (so it survives the same-tab Universal-Link navigation), and when the
  /// tab becomes visible again we ask, marking paid on "Yes".
  const payConfirmKey = () => `splitea:pay-confirm:${props.snapshot.receipt.id}`;
  const [payConfirm, setPayConfirm] = createSignal<{
    contactId: string;
    payerName: string;
  } | null>(null);

  const armPayConfirm = (contactId: string) => {
    try {
      sessionStorage.setItem(
        payConfirmKey(),
        JSON.stringify({ contactId, payerName: payerDisplayName(), at: Date.now() }),
      );
    } catch {
      /* storage blocked — skip the return prompt this session */
    }
  };

  const checkPayConfirm = () => {
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(payConfirmKey());
    } catch {
      return;
    }
    if (!raw) return;
    const clear = () => {
      try {
        sessionStorage.removeItem(payConfirmKey());
      } catch {
        /* ignore */
      }
    };
    let rec: { contactId?: string; payerName?: string; at?: number };
    try {
      rec = JSON.parse(raw);
    } catch {
      clear();
      return;
    }
    const age = Date.now() - (rec.at ?? 0);
    // Ignore a visibility flip in the same tick as the tap (no real
    // hand-off happened); drop stale arms after 15 minutes.
    if (age < 600) return;
    if (age > 15 * 60_000 || !rec.contactId) {
      clear();
      return;
    }
    // Only ask if that debtor still owes — they may have settled
    // elsewhere or already tapped "Mark as paid".
    const cand = payCandidates().find((c) => c.contactId === rec.contactId);
    if (!cand || cand.settlementState !== "owes") {
      clear();
      return;
    }
    clear();
    setPayConfirm({
      contactId: rec.contactId,
      payerName: rec.payerName || payerDisplayName(),
    });
  };

  onMount(() => {
    checkPayConfirm();
    const onVisible = () => {
      if (document.visibilityState === "visible") checkPayConfirm();
    };
    const onPageShow = () => checkPayConfirm();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onPageShow);
    onCleanup(() => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onPageShow);
    });
  });

  return (
    // Layout: a flex column that fills its parent
    // (`.ios-nav-pushed`, which is `position: fixed; inset: 0`
    // of the viewport) with an internal `flex-1 overflow-y-auto`
    // scroll area. The fixed-overlay parent is what enables the
    // OnsenUI iOS-slide push/pop animation — sliding a body-
    // flow element with `transform: translateX` is fine, but
    // we'd lose viewport-relative pinning during the animation.
    // The cost: this view scrolls internally rather than at the
    // body root, so iOS 26 Safari's bottom-toolbar Liquid Glass
    // bleed-through doesn't engage here. We accept that to keep
    // the iOS-native push/pop feel.
    //
    // No `pt-[env(safe-area-inset-top)]` here. We had it
    // briefly to lift content out from under the Dynamic Island
    // in PWA mode, but it was non-zero on some Android browser
    // chromes too — pushing the NavBar visibly lower than the
    // matching NavBar in `ItemsView` / `ReceiptViewer`, which
    // don't have the same wrapper-level padding. For now the
    // NavBar handles its own internal layout; if/when we ship
    // a PWA build, we'll add `safe-area-inset-top` once at
    // the body or `.ios-nav-stack` level so every surface
    // (base, overlay, modal) gets the same inset uniformly.
    //
    // `h-dvh` (NOT `min-h-dvh`) — locks the wrapper to
    // exactly 100dvh and routes scroll into the internal
    // `<main overflow-y-auto>` below. A brief experiment
    // with `min-h-dvh + body scroll` (to coax Safari iOS 18
    // into rendering its chrome in the standard light style)
    // broke scrolling entirely because the parent
    // `.ios-nav-pushed` is `position: fixed; top: 0; bottom: 0`
    // — content inside a fixed element doesn't drive body
    // scroll, so the wrapper grew past the visible viewport
    // but had nowhere to scroll to. We accept Safari's
    // compact chrome on this view as the price of the
    // iOS-style push/pop animation pattern.
    <div class="h-dvh flex flex-col bg-ios-bg text-ios-label relative">
      {/*
        Bottom-padding clears the entire Pay bar (button + the
        full 64px gradient region above) so the last content
        sits comfortably above the bar's top fade with
        breathing room. Anatomy:

          64px gradient region (the fade-behind zone)
          + 48px button height
          + 12px button bottom interior padding
          + env(safe-area-inset-bottom)
          ≈ 124px + env(safe-area-inset-bottom)

        Previously we tried 60px (clears only the solid button
        region) and 72px (clears solid region + 12px slack);
        both made the last content row read as crammed against
        the button. 124px+safe-area reserves the FULL bar
        footprint so the last card has at least the gradient
        zone of breathing room above the button — content can
        still scroll INTO the gradient when the user actively
        scrolls down (the 64px fade-behind is preserved as a
        mid-scroll affordance), but at-rest the last item has
        comfortable air above the chrome.

        When the Pay bar isn't rendered (visitor isn't the
        payer / no providers configured), the standard 16px
        + safe-area baseline applies.
      */}
      <main
        // `flex-1 overflow-y-auto` — main owns all scrolling
        // because the wrapper is locked to viewport height
        // (see h-dvh rationale above). Bottom padding clears
        // the absolute-positioned Pay bar so the last content
        // row sits comfortably above the bar's top fade.
        // Anatomy:
        //   64px gradient fade region
        //   + 48px button height
        //   + 12px button bottom interior padding
        //   + env(safe-area-inset-bottom)
        //   ≈ 124px + env(safe-area-inset-bottom)
        // The shorter no-Pay-bar variant (16px + safe-area)
        // is the regular baseline gutter.
        class="flex-1 overflow-y-auto"
        classList={{
          "pb-[calc(108px+env(safe-area-inset-bottom))]":
            canPay(),
          "pb-[calc(16px+env(safe-area-inset-bottom))]":
            !(canPay()),
        }}
      >
        <NavBar
          title={props.snapshot.receipt.merchantName ?? "Receipt"}
          leading={
            props.onBack ? (
              <BackButton onClick={() => props.onBack!()} />
            ) : undefined
          }
          trailing={
            props.onEdit ? (
              <EditButton onClick={() => props.onEdit!()} />
            ) : undefined
          }
        />
        <div class="safe-px pt-2 space-y-7">
        {/* Receipt image section — mirrors iOS
            `receiptImageSection(_:)` in
            `SavedReceiptDetailView.swift:310`:
              VStack(spacing: 8) {
                Button { showingFullImage = true } label: {
                  Image(uiImage: image)
                    .resizable().scaledToFit()
                    .frame(maxHeight: 240)
                    .shadow(color: .black.opacity(0.2), radius: 5, y: 4)
                }
                Text(displayDate.formatted(date: .long,
                  time: receiptDate != nil ? .shortened : .omitted))
                  .font(.footnote).foregroundStyle(.secondary)
              }
              .padding(.vertical, 12)
            Skipped when no image is captured (PDF-only or
            manual-entry receipts) — the breakdown card
            below carries the date in its own layout. */}
        <Show when={props.snapshot.receipt.receiptImageBase64}>
          {(b64) => (
            <section class="flex flex-col items-center gap-2 pb-3">
              <button
                type="button"
                class="block max-w-full active:opacity-80 transition-opacity"
                aria-label="View full receipt"
                onClick={() => setShowingReceipt(true)}
              >
                <img
                  src={`data:${props.snapshot.receipt.receiptMimeType};base64,${b64()}`}
                  alt="Receipt"
                  class="max-h-60 w-auto rounded-ios-card-inner"
                  style={{
                    // iOS shadow: `.shadow(color: .black.opacity(0.2),
                    // radius: 5, y: 4)`. CSS box-shadow takes blur as
                    // 2× the SwiftUI radius (different falloff math),
                    // so radius 5 → blur 10. Y-offset matches.
                    "box-shadow": "0 4px 10px rgba(0,0,0,0.2)",
                  }}
                />
              </button>
              <Show when={props.snapshot.receipt.receiptDate}>
                {(date) => (
                  <span class="text-ios-footnote text-ios-label-secondary">
                    {formatReceiptDateTime(date(), {
                      includeTime: true,
                    })}
                  </span>
                )}
              </Show>
            </section>
          )}
        </Show>

        {/* "Breakdown" section header with a global Expand /
            Collapse toggle on the right — same affordance
            the iOS `BreakdownSectionsView` ships in its
            section header. */}
        <Show when={breakdowns().length > 0}>
          <section>
            <div class="flex items-center justify-between px-2 mb-2">
              <h2 class="text-ios-title-3 text-ios-label">Breakdown</h2>
              {/* iOS Expand/Collapse uses `.subheadline`
                  (15pt) per `BreakdownSectionsView.swift:93`.
                  We were one tier large at 17pt. */}
              <button
                type="button"
                class="text-ios-subheadline text-ios-blue active:opacity-60 transition-opacity"
                onClick={toggleAll}
                aria-pressed={allExpanded()}
              >
                {allExpanded() ? "Collapse" : "Expand"}
              </button>
            </div>
            {/* One card PER CONTACT — mirrors the iOS
                `BreakdownSectionsView` layout where each
                contact's breakdown is its own self-contained
                rounded card, separated by `space-y` gaps
                rather than hairlines inside one big card. The
                visual difference matters: separate cards read
                as "independent slices of the bill" (one per
                person), while a single card with dividers
                reads as a list of rows. iOS uses the former.
                `space-y-5` (20px) matches the gap iOS uses
                between contact-breakdown sections — bigger
                than the standard InsetGrouped 8pt section
                gap because each contact's card is a
                conceptually separate "receipt slice" and
                deserves real breathing room. */}
            <div class="space-y-5">
              <For each={breakdowns()}>
                {(row) => {
                  /// Show the Pay button as a card-footer
                  /// inside the payer's breakdown card —
                  /// only when the share's author IS the
                  /// payer (the gating story we already
                  /// have for the global Pay surface) AND
                  /// they have at least one configured
                  /// payment provider.
                  ///
                  // Press-feedback background swap: while the
                  // user is actively touching / clicking the
                  // disclosure's summary button, the wrapper
                  // fades from `bg-ios-card` (#1c1c1e) to
                  // `bg-ios-card-hi` (#2c2c2e); on release the
                  // bg fades back. Mirrors UIKit's standard
                  // touch-down highlight on a grouped-list
                  // cell. Tailwind's `has-[button:active]:`
                  // selector reads the descendant button's
                  // `:active` pseudo-class so the parent
                  // responds without any JS plumbing.
                  // 200ms / cubic-bezier(0.32,0.72,0,1) is
                  // close enough to UIKit's
                  // `tertiarySystemFill` press transition;
                  // shorter than the disclosure's height
                  // animation since press feedback should
                  // feel snappier than a layout change.
                  // Card corner radius is `rounded-ios-card`
                  // (22pt) — matches the iOS app's
                  // `cornerRadius: 22, style: .continuous`.
                  return (
                    <div class="bg-ios-card has-[button:active]:bg-ios-card-hi transition-colors duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] rounded-ios-card overflow-hidden">
                      <ContactBreakdownRow
                        contact={row.contact!}
                        amount={row.total}
                        isPayer={isPayer(row.contact!.phoneNumber)}
                        currencyCode={props.snapshot.receipt.currencyCode}
                        items={row.breakdown.items}
                        subtotal={row.breakdown.subtotal}
                        tax={row.breakdown.tax}
                        tip={row.breakdown.tip}
                        open={isRowExpanded(row.breakdown.contactId)}
                        onOpenChange={(next) =>
                          setRowExpanded(row.breakdown.contactId, next)
                        }
                      />
                    </div>
                  );
                }}
              </For>
            </div>
          </section>
        </Show>

        {/* Items missing any assignment. iOS surfaces these
            with a yellow warning-triangle header and a
            secondary-styled list so the reader knows the
            breakdown above + summary below DO NOT account for
            these line items. Hidden when nothing is
            unassigned (matches iOS's `if !unassignedItems
            .isEmpty` guard in `SplitSummaryView`). */}
        <Show when={unassignedItems().length > 0}>
          <UnassignedItemsSection
            items={unassignedItems()}
            currencyCode={props.snapshot.receipt.currencyCode}
          />
        </Show>

        {/* Same `BillSummary` shown on the previous screen,
            recomputed from the live snapshot — these stay in
            sync with WebSocket-driven mutations because the
            store is a single shared signal upstream. */}
        <BillSummary
          receipt={props.snapshot.receipt}
          items={props.snapshot.items}
        />

        {/* When the receipt has no captured image, the date
            wouldn't otherwise surface anywhere on this view —
            the receipt-image section above is the only place
            iOS shows it. Render a centered footer instead so
            non-image receipts still carry the date stamp. */}
        <Show
          when={
            !props.snapshot.receipt.receiptImageBase64 &&
            props.snapshot.receipt.receiptDate
          }
        >
          {(date) => (
            <div class="px-2 text-ios-footnote text-ios-label-secondary text-center">
              {formatReceiptDateTime(date(), { includeTime: true })}
            </div>
          )}
        </Show>
        </div>
      </main>

      {/*
        iOS 26 Liquid Glass bottom bar — Pay action.

        Visible only when the share author is the payer AND has
        at least one configured payment provider. The bar
        ALWAYS sits at the visible bottom regardless of scroll
        position because it's a sibling of `<main>` (the only
        scrolling element) inside the `h-full flex flex-col`
        container — the layout flex pins it to the bottom edge
        while `<main flex-1 overflow-y-auto>` consumes the
        remaining space and handles its own internal scrolling.

        Two stacked layers compose the iOS 26 Liquid Glass look:

        Layer 1 — `taller frame` with backdrop-filter blur. The
          frame extends ~64px ABOVE the button, with a
          transparent-to-black vertical gradient as its
          background. Top edge is fully transparent so content
          peeking through reads as "fading behind the bar";
          bottom edge is opaque so the button has solid
          contrast. The whole frame applies
          `backdrop-filter: blur(20px) saturate(180%)` so any
          content sitting behind it gets the iOS-26-standard
          frost. With the gradient fill on top, the visual
          effect is "clear at the top, frosted black at the
          bottom" — same as iOS 26's tab bar / toolbar
          pattern.

        Layer 2 — the actual button capsule, positioned in
          the bottom region of the frame above the home-
          indicator gutter.

        We don't use a uniform-opacity fill (the previous
        version was `rgba(28,28,30,0.72)` everywhere, which
        made the bar's top edge a hard line and content
        appeared to "cut off" abruptly rather than fade behind
        it).
      */}
      <Show
        when={canPay()}
      >
        <div
          // `absolute inset-x-0 bottom-0` — pinned to the
          // bottom of the `h-dvh` wrapper (which equals the
          // visible viewport bottom). Pairs with `<main
          // overflow-y-auto>` above: main scrolls internally
          // while this bar stays put. We tried `position:
          // sticky` and `position: fixed` to enable body
          // scroll for Safari light chrome but both broke
          // scrolling because of the `.ios-nav-pushed` fixed
          // parent (see h-dvh comment above).
          class="absolute inset-x-0 bottom-0 px-4 pointer-events-none"
          style={{
            // Frame height: ~64px gradient fade above the
            // button + button row + safe-area inset. The
            // gradient region overlaps the scroll content
            // intentionally — content scrolling up FADES
            // behind the bar rather than abruptly stopping
            // at a hard edge.
            "padding-top": "64px",
            "padding-bottom": "calc(env(safe-area-inset-bottom) + 12px)",
            // Solid scrim fill via `--ios-scrim` (light ≈
            // white@92%, dark ≈ black@92%). The smooth
            // fade-in is handled by `mask-image` below, NOT
            // by gradient-ing the background itself. Why:
            // the bar applies `backdrop-filter: blur(20px)`
            // uniformly, and `backdrop-filter` can't take a
            // gradient. So even a transparent-at-top color
            // gradient still had a hard blur boundary at the
            // bar's top edge — the blur snapped on at 100%
            // strength even where the color was fully
            // transparent. mask-image fades the ENTIRE
            // element including the backdrop-filtered
            // region, so blur AND color ramp in together
            // with no abrupt edge.
            background: "var(--ios-scrim)",
            "backdrop-filter": "blur(20px) saturate(180%)",
            "-webkit-backdrop-filter": "blur(20px) saturate(180%)",
            // Mask: the bar's top is fully transparent
            // (revealing content through), ramping linearly
            // to fully opaque by 55% down. Beyond 55% the
            // bar is fully visible (button area + safe-area
            // gutter). The CSS gradient is on the alpha
            // channel since `transparent → black` is the
            // mask's default mode — black pixels keep the
            // element visible, transparent pixels hide it.
            "mask-image":
              "linear-gradient(to bottom," +
              " transparent 0%," +
              " rgba(0,0,0,0.4) 30%," +
              " black 55%)",
            "-webkit-mask-image":
              "linear-gradient(to bottom," +
              " transparent 0%," +
              " rgba(0,0,0,0.4) 30%," +
              " black 55%)",
          }}
        >
          <div class="flex flex-col gap-2 pointer-events-auto">
            {/* Pay button — shown only when the payer has a
                configured provider AND there is a non-payer debtor
                to pay for (else the identity picker is empty and
                the flow dead-ends). See `canPay`. */}
            <Show when={canPay()}>
              <button
                type="button"
                class="block w-full h-12 rounded-full bg-ios-blue text-white text-ios-headline font-semibold active:opacity-80 transition-opacity truncate"
                onClick={() => setShowingPayMenu(true)}
              >
                Pay {senderDisplayName()}
              </button>
            </Show>

          </div>
        </div>
      </Show>

      {/* Provider-picker sheet. Mounted only while open — its
          backdrop scrim and slide-in animation cost something
          to keep alive idly, and we have nothing to remember
          across opens. */}
      <Show when={showingPayMenu()}>
        <PayMenuSheet
          payerDisplayName={senderDisplayName()}
          paymentUsernames={payerContact()?.paymentUsernames}
          receiptID={props.snapshot.receipt.id}
          candidates={payCandidates()}
          currencyCode={props.snapshot.receipt.currencyCode}
          merchantName={props.snapshot.receipt.merchantName}
          forcedContactId={props.forContactId ?? null}
          onMarkPaid={onMarkPaid}
          onProviderTap={armPayConfirm}
          onClose={() => setShowingPayMenu(false)}
        />
      </Show>

      {/* "Did you pay <payer>?" — the iOS-style confirmation shown when
          the visitor returns after tapping a payment provider. */}
      <IOSAlert
        open={payConfirm() !== null}
        title={`Did you pay ${payConfirm()?.payerName ?? "the payer"}?`}
        confirmLabel="Yes"
        cancelLabel="No"
        onConfirm={() => {
          const c = payConfirm();
          if (c) onMarkPaid(c.contactId);
          setPayConfirm(null);
        }}
        onCancel={() => setPayConfirm(null)}
      />

      {/* Receipt-image fullscreen overlay — only mounted when
          toggled on, to keep the base64 payload from being
          decoded into a DOM image (and a PDF iframe for
          PDF-typed receipts) until the user actually requests
          the larger view. Uses the same `ReceiptViewer`
          component as the merchant-row icon button on
          ItemsView, so behavior + close-gesture stay
          consistent across the two entry points. */}
      <Show
        when={
          showingReceipt() && props.snapshot.receipt.receiptImageBase64
        }
      >
        <ReceiptViewer
          base64={props.snapshot.receipt.receiptImageBase64!}
          mimeType={props.snapshot.receipt.receiptMimeType}
          merchantName={props.snapshot.receipt.merchantName}
          receiptDateMs={props.snapshot.receipt.receiptDate}
          onClose={() => setShowingReceipt(false)}
        />
      </Show>
    </div>
  );
}
