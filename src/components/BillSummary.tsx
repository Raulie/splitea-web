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
    //   • `rounded-[36px]` matches the breakdown cards
    //     above so the whole stack reads as one consistent
    //     surface rather than mixed curvature.
    //   • `squircle` swaps the default circle-quadrant
    //     corner curve for the iOS continuous superellipse.
    //   • Padding of 18px on every side from the card's
    //     edge to the row content. Derived per Apple's
    //     ConcentricRectangle rule (`inner_radius =
    //     container_radius − spacing`) and the article's
    //     2:1 example (24pt container with 12pt padding).
    //     For our 36pt card, half is 18pt — the spacing
    //     that lets a non-rounded inner content area sit
    //     concentric with the corner curve.
    //
    // The 18pt spacing is split: the section contributes
    // `pt-[6px] pb-[6px]` and each row contributes its
    // own `py-3` (12px) — totaling 18px above the first
    // row's text and below the last row's text. Rows
    // contribute the full 18px horizontal via `px-[18px]`
    // (see Row / TotalRow). Middle rows (Tax, Tip) keep
    // their tighter `py-3` between hairlines because the
    // 18pt-from-card-edge rule applies to the
    // content/card boundary, not to row-to-row spacing.
    <section class="bg-ios-card rounded-[36px] squircle ios-list-divide overflow-hidden pt-[6px] pb-[6px]">
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
