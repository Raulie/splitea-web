import { createSignal, For, Show } from "solid-js";
import type { ReceiptSnapshot } from "../types/snapshot";
import { ContactBreakdownRow } from "../components/ContactBreakdownRow";
import { BillSummary } from "../components/BillSummary";
import { UnassignedItemsSection } from "../components/UnassignedItemsSection";
import { BackButton } from "../components/BackButton";
import { EditButton } from "../components/EditButton";
import { NavBar } from "../components/NavBar";
import { ReceiptViewer } from "../components/ReceiptViewer";
import { PayMenuSheet } from "../components/PayMenuSheet";
import {
  calculateContactBreakdowns,
} from "../lib/moneyMath";
import { formatReceiptDateTime } from "../lib/format";
import { configuredPayProviders } from "../lib/payProviders";

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
  const [expanded, setExpanded] = createSignal(new Set<string>());

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

  /// The contact who AUTHORED the snapshot — i.e. the person
  /// who created the share link. Mirrors iOS's encode-time
  /// `isUserContact: true` flag (the iOS materialise step
  /// force-clears that flag on import to local SwiftData,
  /// but the web reads the JSON directly so the original
  /// authoring contact is identifiable here).
  const senderContact = () =>
    props.snapshot.contacts.find((c) => c.isUserContact);

  /// `senderIsPayer` gates the bottom Pay button. The button
  /// only makes sense when the person who shared the link is
  /// also the person who fronted the bill — that's when a
  /// recipient might want to pay them back. Other cases
  /// (different sender / payer, or no payer set) hide it.
  const senderIsPayer = () => {
    const sender = senderContact();
    if (!sender) return false;
    return isPayer(sender.phoneNumber);
  };

  /// Provider rows that will populate the modal. Computed up
  /// here so the Pay button can also key off it — no point
  /// rendering the button if the sender / payer hasn't
  /// configured any payment providers (older iOS builds that
  /// pre-date the `paymentUsernames` field would land here
  /// too, so the button gracefully hides).
  const senderProviders = () =>
    configuredPayProviders(senderContact()?.paymentUsernames);

  const senderDisplayName = () =>
    senderContact()?.fullName?.trim() || "the sender";

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
      }));

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
    <div class="h-full flex flex-col bg-ios-bg text-ios-label">
      <main class="flex-1 overflow-y-auto pb-[calc(16px+env(safe-area-inset-bottom))]">
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
                  /// `senderContact()` is identified by
                  /// `isUserContact: true` in the snapshot
                  /// (encode-time author flag preserved on
                  /// the wire); we match by contactId so a
                  /// stale phone-number comparison can't
                  /// pin the footer to the wrong row.
                  const isPayerCard = () =>
                    senderIsPayer() &&
                    senderProviders().length > 0 &&
                    row.contact !== undefined &&
                    senderContact()?.id === row.contact.id;
                  return (
                    <div class="bg-ios-card rounded-[36px] squircle overflow-hidden">
                      {/* Card corner radius is 36px on
                          every breakdown card. The radius
                          is the SwiftUI concentric rule
                          (`outer = inner + spacing`)
                          applied on the payer's card —
                          its inner Pay capsule has
                          effective radius `height/2 =
                          24px` plus 12px of side / bottom
                          padding gives 36px. Other
                          breakdown cards have no concentric
                          inner anchor of their own, but
                          they share the same 36px so the
                          row of cards reads as a uniform
                          stack rather than mismatched
                          curvature card-by-card. */}
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
                      <Show when={isPayerCard()}>
                        {/* Pay-button footer for the
                            payer's card. The button is a
                            capsule (height/2 corner
                            radius), inset with 12px of
                            padding on the sides + bottom
                            of the card. NO top padding —
                            the button sits flush against
                            the disclosure content above
                            so it reads as the natural
                            footer of the row, not a
                            floating element with extra
                            breathing room.

                            Concentricity story: capsule
                            inner radius = 48 ÷ 2 = 24px,
                            outer card radius (sides +
                            bottom) = 24 + 12 = 36px. The
                            curve gap between capsule and
                            card stays constant at 12px
                            the whole way around the
                            bottom corners — same SwiftUI
                            `ConcentricRectangle` derives
                            from `outer = inner + spacing`. */}
                        <div class="px-3 pb-3">
                          <button
                            type="button"
                            class="block w-full h-12 rounded-full squircle bg-ios-blue text-white text-ios-headline font-semibold active:opacity-80 transition-opacity"
                            onClick={() => setShowingPayMenu(true)}
                          >
                            Pay
                          </button>
                        </div>
                      </Show>
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

      {/* Provider-picker sheet. Mounted only while open — its
          backdrop scrim and slide-in animation cost something
          to keep alive idly, and we have nothing to remember
          across opens. */}
      <Show when={showingPayMenu()}>
        <PayMenuSheet
          payerDisplayName={senderDisplayName()}
          paymentUsernames={senderContact()?.paymentUsernames}
          receiptID={props.snapshot.receipt.id}
          candidates={payCandidates()}
          currencyCode={props.snapshot.receipt.currencyCode}
          merchantName={props.snapshot.receipt.merchantName}
          forcedContactId={props.forContactId ?? null}
          onClose={() => setShowingPayMenu(false)}
        />
      </Show>

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
