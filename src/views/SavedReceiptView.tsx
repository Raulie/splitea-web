import { createSignal, For, Show } from "solid-js";
import type { ReceiptSnapshot } from "../types/snapshot";
import { ContactBreakdownRow } from "../components/ContactBreakdownRow";
import { BillSummary } from "../components/BillSummary";
import { BackButton } from "../components/BackButton";
import { NavBar } from "../components/NavBar";
import { ReceiptViewer } from "../components/ReceiptViewer";
import {
  calculateContactBreakdowns,
} from "../lib/moneyMath";
import { formatReceiptDateTime } from "../lib/format";

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
  /// associated CSS state — see `ItemsView`.
  onBack: () => void;
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
    // `pt-[env(safe-area-inset-top)]` adds the device safe-area
    // inset above the nav bar — relevant in PWA / standalone
    // display mode on Dynamic Island devices.
    <div class="h-full flex flex-col bg-ios-bg text-ios-label pt-[env(safe-area-inset-top)]">
      <main class="flex-1 pt-2 pb-[calc(16px+env(safe-area-inset-bottom))] overflow-y-auto">
        <NavBar
          title={props.snapshot.receipt.merchantName ?? "Receipt"}
          leading={<BackButton onClick={() => props.onBack()} />}
        />
        <div class="px-4 space-y-7">
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
            <section class="flex flex-col items-center gap-2 py-3">
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
                {(row) => (
                  <div class="bg-ios-card rounded-ios-card overflow-hidden">
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
                )}
              </For>
            </div>
          </section>
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
          onClose={() => setShowingReceipt(false)}
        />
      </Show>
    </div>
  );
}
