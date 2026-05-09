import { Show } from "solid-js";
import type { ItemPayload, ReceiptPayload } from "../types/snapshot";
import {
  billGrandTotal,
  billSubtotal,
  billTaxTotal,
  billTipAmount,
} from "../lib/moneyMath";
import { formatCurrency } from "../lib/format";

/// Subtotal / Tax / Tip / Total card. Mirrors the iOS
/// `summarySection` block in `ItemsView.swift` and uses the
/// exact same math as `BillSplitViewModel`'s computed
/// properties (`subtotal`, `taxTotal`, `tipAmount`,
/// `grandTotal`) — see `lib/moneyMath.ts` for the line-by-
/// line port.
///
/// Notable iOS rules surfaced here:
///   • The tax row hides entirely when `taxInclusive` is
///     true (prices already include tax — showing "$0.00"
///     would mislead).
///   • The tax label includes a printed rate like "(7%)"
///     when `taxRate` is known, otherwise it's just "Tax".
///     iOS uses the rate from `viewModel.taxRate` which we
///     mirror via `receipt.taxRate`.
///   • The total row is bold + larger; iOS uses
///     `.font(.title3).fontWeight(.bold)` for the value
///     and `.subheadline.bold()` for the label.
export interface BillSummaryProps {
  receipt: ReceiptPayload;
  items: ItemPayload[];
}

export function BillSummary(props: BillSummaryProps) {
  const subtotal = () => billSubtotal(props.items);
  const tax = () => billTaxTotal(props.receipt, props.items);
  const tip = () => billTipAmount(props.receipt, subtotal());
  const total = () => billGrandTotal(props.receipt, props.items);
  const currency = () => props.receipt.currencyCode;

  /// Tax label — iOS appends `(rate%)` when the parsed tax
  /// rate is known. Format the rate without trailing zeros
  /// (`7` not `7.0`, `11.5` not `11.50`) — same `.formatted()`
  /// behavior Swift's `Decimal` gives by default.
  const taxLabel = () => {
    const rate = props.receipt.taxRate;
    if (rate === null || rate === undefined) return "Tax";
    const trimmed = Number.isInteger(rate)
      ? rate.toString()
      : rate.toFixed(2).replace(/\.?0+$/, "");
    return `Tax (${trimmed}%)`;
  };

  return (
    // Card chrome + concentric padding:
    //
    //   • `rounded-ios-card` (22pt) matches every other card
    //     on this view — breakdown rows, ReceiptInfoCard,
    //     ItemsList — so the stack reads as one consistent
    //     surface. iOS app uses `cornerRadius: 22` on its
    //     equivalent prominent cards, so the web matches.
    //   • `squircle` swaps the default circle-quadrant
    //     corner curve for the iOS continuous superellipse.
    //   • Vertical padding 6+12=18px above the first row's
    //     text and below the last row's text. The horizontal
    //     padding (rows' `px-[18px]`) is unchanged from the
    //     previous design because it doesn't depend on the
    //     card radius — it's just visually pleasant gutter.
    //     Middle rows (Tax, Tip) keep their tighter `py-3`
    //     between hairlines.
    <section class="bg-ios-card rounded-ios-card squircle ios-list-divide overflow-hidden pt-[6px] pb-[6px]">
      <Row label="Subtotal" value={formatCurrency(subtotal(), currency())} />
      <Show when={!props.receipt.taxInclusive}>
        <Row label={taxLabel()} value={formatCurrency(tax(), currency())} />
      </Show>
      <Row label="Tip" value={formatCurrency(tip(), currency())} />
      <TotalRow value={formatCurrency(total(), currency())} />
    </section>
  );
}

interface RowProps {
  label: string;
  value: string;
}

function Row(props: RowProps) {
  // Verbatim port of iOS `summaryRow` in
  // `Splitea/Views/BillSplit/ItemsView.swift:459-470`:
  //   Label:  .subheadline (15pt)  .secondary
  //   Value:  .subheadline (15pt)  .medium  .primary
  // Horizontal padding bumped from `px-4` (16px) to
  // `px-[18px]` to keep the row content at a uniform
  // 18px concentric inset from the 36px card corners
  // (see the section comment in `BillSummary` for the
  // ConcentricRectangle math).
  return (
    <div class="px-[18px] py-3 flex items-center">
      <span class="text-ios-subheadline text-ios-label-secondary">
        {props.label}
      </span>
      <span class="ml-auto text-ios-subheadline font-medium text-ios-label">
        {props.value}
      </span>
    </div>
  );
}

function TotalRow(props: { value: string }) {
  // iOS Total row from `ItemsView.swift:446-455`:
  //   Label:  .subheadline (15pt)  .bold      .primary
  //   Value:  .title3      (20pt)  .bold      .primary
  // Same `px-[18px]` concentric horizontal inset as
  // `Row` — keeps the value column right-aligned to a
  // uniform 18px from the card's right edge.
  return (
    <div class="px-[18px] py-3 flex items-center">
      <span class="text-ios-subheadline font-bold text-ios-label">
        Total
      </span>
      <span class="ml-auto text-ios-title-3 font-bold text-ios-label">
        {props.value}
      </span>
    </div>
  );
}
