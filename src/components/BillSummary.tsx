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
    // iOS pads the first row's TOP and the last row's BOTTOM
    // a bit beyond the standard `py-3` middle-row spacing —
    // the card breathes a little around its outer edges so the
    // Subtotal label doesn't kiss the rounded top corner and
    // Total doesn't kiss the bottom corner. The middle rows
    // (Tax, Tip) keep their tighter inset because they're
    // separated by hairlines, not card edges.
    <section class="bg-ios-card rounded-ios-card divide-y divide-ios-separator overflow-hidden pt-1 pb-1">
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
  // The previous `text-ios-body` (17pt) read one tier
  // larger than iOS.
  return (
    <div class="px-4 py-3 flex items-center">
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
  return (
    <div class="px-4 py-3 flex items-center">
      <span class="text-ios-subheadline font-bold text-ios-label">
        Total
      </span>
      <span class="ml-auto text-ios-title-3 font-bold text-ios-label">
        {props.value}
      </span>
    </div>
  );
}
