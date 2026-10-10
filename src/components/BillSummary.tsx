import { Show } from "solid-js";
import type { ItemPayload, ReceiptPayload } from "../types/snapshot";
import {
  billGrandTotal,
  billSubtotal,
  billTaxTotal,
  billTipAmount,
  uniformItemRate,
} from "../lib/moneyMath";
import { formatCurrency } from "../lib/format";
import { t } from "../lib/i18n";
import type { ConvertedBill } from "../lib/currencyConversion";

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
  converted?: ConvertedBill | null;
}

export function BillSummary(props: BillSummaryProps) {
  const subtotal = () => props.converted?.subtotal ?? billSubtotal(props.items);
  const tax = () =>
    props.converted?.tax ?? billTaxTotal(props.receipt, props.items);
  const tip = () =>
    props.converted?.tip ??
    billTipAmount(props.receipt, billSubtotal(props.items), billTaxTotal(props.receipt, props.items));
  const total = () => props.converted?.grandTotal ?? billGrandTotal(props.receipt, props.items);
  const currency = () => props.converted?.currencyCode ?? props.receipt.currencyCode;
  const rateText = () => {
    const c = props.converted;
    if (!c || !(c.rate > 0)) return null;
    const flipped = c.rate < 1;
    const unit = flipped ? c.currencyCode : c.originalCurrencyCode;
    const quote = flipped ? c.originalCurrencyCode : c.currencyCode;
    const value = flipped ? 1 / c.rate : c.rate;
    const number = value.toLocaleString(undefined, { maximumSignificantDigits: 4, useGrouping: false });
    return `1 ${unit} = ${number} ${quote}`;
  };
  const originalText = () => {
    const c = props.converted;
    return c ? formatCurrency(c.originalTotal, c.originalCurrencyCode) : null;
  };

  /// Tax label — iOS appends `(rate%)` when the parsed tax
  /// rate is known. Format the rate without trailing zeros
  /// (`7` not `7.0`, `11.5` not `11.50`) — same `.formatted()`
  /// behavior Swift's `Decimal` gives by default.
  /// Effective rate for the "Tax (X%)" label: the receipt-level rate
  /// (tax-inclusive jurisdictions), else the per-item rate when every
  /// taxed item shares one (the common US/PR case) so it shows once
  /// here instead of being implicit on each item. Mirrors iOS
  /// `BillSummarySection.displayRate`.
  const effectiveRate = (): number | null => {
    const receiptRate = props.receipt.taxRate;
    if (receiptRate !== null && receiptRate !== undefined) return receiptRate;
    return uniformItemRate(props.items);
  };

  const taxLabel = () => {
    const rate = effectiveRate();
    if (rate === null || rate === undefined) return t("summaryTaxLabel");
    const trimmed = Number.isInteger(rate)
      ? rate.toString()
      : rate.toFixed(2).replace(/\.?0+$/, "");
    return t("summaryTaxLabelWithRate", { rate: trimmed });
  };

  /// Tip label — same treatment as the tax rate: "Tip (20%)" when the
  /// tip was entered as a percentage, plain "Tip" for an amount-typed
  /// tip (where the dollar value already IS the row). Mirrors iOS
  /// `BillSummarySection.tipLabel` / `ItemsView.summarySection`.
  const tipLabel = () => {
    const { tipType, tipValue } = props.receipt;
    if (tipType !== "percentage" || !tipValue || tipValue <= 0)
      return t("summaryTipLabel");
    const trimmed = Number.isInteger(tipValue)
      ? tipValue.toString()
      : tipValue.toFixed(2).replace(/\.?0+$/, "");
    return t("summaryTipLabelWithRate", { rate: trimmed });
  };

  // Card chrome + concentric padding:
  //
  //   • `rounded-ios-card` (26px) matches every other card
  //     on this view — breakdown rows, ReceiptInfoCard,
  //     ItemsList — so the stack reads as one consistent
  //     surface. iOS app uses `cornerRadius: 22` on its
  //     equivalent prominent cards, so the web matches.
  //   • Vertical padding 6+12=18px above the first row's
  //     text and below the last row's text. The horizontal
  //     padding (rows' `px-[18px]`) is unchanged from the
  //     previous design because it doesn't depend on the
  //     card radius — it's just visually pleasant gutter.
  //     Middle rows (Tax, Tip) keep their tighter `py-3`
  //     between hairlines.
  return (
    <>
    <section class="bg-ios-card rounded-ios-card ios-list-divide overflow-hidden pt-[6px] pb-[6px]">
      <Row
        label={t("summarySubtotalLabel")}
        value={formatCurrency(subtotal(), currency())}
      />
      <Show when={!props.receipt.taxInclusive}>
        <Row label={taxLabel()} value={formatCurrency(tax(), currency())} />
      </Show>
      <Row label={tipLabel()} value={formatCurrency(tip(), currency())} />
      <TotalRow value={formatCurrency(total(), currency())} secondary={originalText()} />
    </section>
    <Show when={rateText()}>
      <p class="px-[18px] pt-2 text-ios-footnote text-ios-label-secondary">
        {t("summaryConvertedAtNote", { rate: rateText()! })}
      </p>
    </Show>
    </>
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

function TotalRow(props: { value: string; secondary?: string | null }) {
  // iOS Total row from `ItemsView.swift:446-455`:
  //   Label:  .subheadline (15pt)  .bold      .primary
  //   Value:  .title3      (20pt)  .bold      .primary
  // Same `px-[18px]` concentric horizontal inset as
  // `Row` — keeps the value column right-aligned to a
  // uniform 18px from the card's right edge.
  return (
    <div class="px-[18px] py-3 flex items-center">
      <span class="text-ios-subheadline font-bold text-ios-label">
        {t("summaryTotalLabel")}
      </span>
      <span class="ml-auto flex flex-col items-end">
        <span class="text-ios-title-3 font-bold text-ios-label">{props.value}</span>
        <Show when={props.secondary}>
          <span class="text-ios-subheadline text-ios-label-secondary">{props.secondary}</span>
        </Show>
      </span>
    </div>
  );
}
