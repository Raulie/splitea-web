/// Verbatim port of `Splitea/Services/MoneyMath.swift` — same
/// rounding semantics, same tax-total strategies. iOS uses
/// `Decimal` for cent-precise arithmetic; web doesn't have a
/// built-in decimal type so we do float math, then snap away
/// binary-float drift before each cent round (see `centsOf`)
/// so the rounded result matches the iOS Decimal math exactly
/// — including at the X.XX5 half-up midpoint.
///
/// All functions take pre-built inputs and return pure
/// outputs. No state; mirrors the Swift module's discipline.

import type { ItemPayload, ReceiptPayload } from "../types/snapshot";

// MARK: - Cent rounding

/// Number of cents in `value`, with binary-float drift
/// removed. `value * 100` should land on an exact cent count
/// but float math leaves it a hair off: $17.145 becomes
/// 1714.4999999999998, $17.14 becomes 1714.0000000000002.
/// Either error flips a directional round the wrong way —
/// `Math.round` drags the .5 midpoint down, `Math.ceil` /
/// `Math.floor` jump a whole cent. Snapping to the nearest
/// 1e-6 of a cent erases the ~1e-11 drift while leaving any
/// genuine sub-cent fraction (`price × rate ÷ 100` bottoms
/// out near 1e-4 cents) untouched, so the round sees the
/// value iOS's `Decimal` would have produced.
function centsOf(value: number): number {
  return Math.round(value * 100 * 1e6) / 1e6;
}

/// Half-up rounding to two decimals. Default for register-
/// style math. `Math.round` takes the .5 midpoint toward
/// `+∞` — same direction `NSDecimalRound(.plain)` takes for
/// the positive Decimals iOS feeds it.
export function roundCents(value: number): number {
  return Math.round(centsOf(value)) / 100;
}

/// Always rounds toward `+∞`. Matches POS systems that round
/// taxes up regardless of the .005 midpoint.
export function roundCentsUp(value: number): number {
  return Math.ceil(centsOf(value)) / 100;
}

/// Always rounds toward 0 (truncates sub-cent fractions).
/// Matches POS systems that floor taxes.
export function roundCentsDown(value: number): number {
  return Math.floor(centsOf(value)) / 100;
}

// MARK: - Tax rounding strategies

/// Mirror of the `TaxRoundingMethod` enum's raw values from
/// `Splitea/Services/ReceiptParser.swift`. Persisted on the
/// snapshot as `receipt.taxRoundingMethod` (string) so the
/// strings here match the wire format exactly.
export type TaxRoundingMethod =
  | "per_item_half_up"
  | "per_item_up"
  | "per_item_down"
  | "on_subtotal_half_up"
  | "on_subtotal_up"
  | "on_subtotal_down"
  | "per_rate_group_half_up"
  | "per_rate_group_down";

/// Calculates the tax total using the specified rounding
/// method. iOS detects the method from the printed tax total
/// at parse time (`detectTaxRounding(items:printedTaxTotal:)`)
/// or lets the user override; we receive the resolved value
/// on the snapshot and apply the matching strategy.
export function calculateTaxTotal(
  items: ItemPayload[],
  method: TaxRoundingMethod,
): number {
  const taxOf = (item: ItemPayload) =>
    (item.price * (item.tax ?? 0)) / 100;

  switch (method) {
    case "per_item_half_up":
      return items.reduce((sum, i) => sum + roundCents(taxOf(i)), 0);
    case "per_item_up":
      return items.reduce((sum, i) => sum + roundCentsUp(taxOf(i)), 0);
    case "per_item_down":
      return items.reduce((sum, i) => sum + roundCentsDown(taxOf(i)), 0);
    case "on_subtotal_half_up":
      return roundCents(items.reduce((sum, i) => sum + taxOf(i), 0));
    case "on_subtotal_up":
      return roundCentsUp(items.reduce((sum, i) => sum + taxOf(i), 0));
    case "on_subtotal_down":
      return roundCentsDown(items.reduce((sum, i) => sum + taxOf(i), 0));
    case "per_rate_group_half_up":
      return groupedByRate(items).reduce(
        (sum, g) => sum + roundCents((g.subtotal * g.rate) / 100),
        0,
      );
    case "per_rate_group_down":
      return groupedByRate(items).reduce(
        (sum, g) => sum + roundCentsDown((g.subtotal * g.rate) / 100),
        0,
      );
    default:
      // Forward-compat: unknown method on the wire → fall
      // back to the iOS default. Same behavior as
      // `Receipt+Helpers.swift`'s `?? .onSubtotalHalfUp`.
      return roundCents(items.reduce((sum, i) => sum + taxOf(i), 0));
  }
}

interface RateGroup {
  rate: number;
  subtotal: number;
}

function groupedByRate(items: ItemPayload[]): RateGroup[] {
  const map = new Map<number, number>();
  for (const item of items) {
    const rate = item.tax ?? 0;
    map.set(rate, (map.get(rate) ?? 0) + item.price);
  }
  return Array.from(map.entries()).map(([rate, subtotal]) => ({
    rate,
    subtotal,
  }));
}

// MARK: - Bill totals

/// Sum of every item's price. iOS doesn't round the subtotal
/// (rounding lives in the per-item math) — same here.
export function billSubtotal(items: ItemPayload[]): number {
  return items.reduce((sum, i) => sum + i.price, 0);
}

/// Tax total. Returns 0 when the receipt is tax-inclusive
/// (the per-item prices already include tax in that case).
export function billTaxTotal(receipt: ReceiptPayload, items: ItemPayload[]): number {
  if (receipt.taxInclusive) return 0;
  return calculateTaxTotal(items, receipt.taxRoundingMethod as TaxRoundingMethod);
}

/// Tip amount. `percentage` types compute tip as a fraction of
/// the bill subtotal and round half-up to cents (matches iOS
/// `roundCents(subtotal * tipValue / 100)`); `amount` types
/// pass through verbatim — iOS doesn't re-round a user-typed
/// dollar value.
export function billTipAmount(receipt: ReceiptPayload, subtotal: number): number {
  if (receipt.tipType === "percentage") {
    return roundCents((subtotal * receipt.tipValue) / 100);
  }
  return receipt.tipValue;
}

/// Subtotal + Tax + Tip — same as `BillSplitViewModel.grandTotal`.
export function billGrandTotal(
  receipt: ReceiptPayload,
  items: ItemPayload[],
): number {
  const sub = billSubtotal(items);
  const tax = billTaxTotal(receipt, items);
  const tip = billTipAmount(receipt, sub);
  return sub + tax + tip;
}

// MARK: - Per-contact breakdown

/// Verbatim port of `calculateContactBreakdowns` from
/// `Services/BillCalculationService.swift`. Two key
/// invariants from the iOS math that aren't obvious:
///
///   1. **Per-contact item subtotal is double-rounded.**
///      iOS calls `roundCents(item.price / count)` for the
///      subtotal — the share of each split is rounded BEFORE
///      summing into the contact total. Same for tax:
///      `roundCents(roundCents(item.price * tax / 100) / count)`.
///      The outer round of the tax term means: round the
///      item's tax first (normal half-up), then round each
///      contact's share of that. This matches the way
///      register receipts allocate tax across split bills
///      and avoids penny-distribution drift.
///
///   2. **Tip is allocated by pre-tip subtotal share.**
///      `tipShare = round(tipAmount × contactSubtotal /
///      billSubtotal)`. iOS weights tip on subtotal only,
///      not subtotal+tax. We do the same.
export interface ContactBreakdown {
  contactId: string;
  subtotal: number;
  tax: number;
  tip: number;
  /// Per-item rollup — one entry per item this contact is on,
  /// with the contact's split share of that item. Mirrors
  /// `BillSplitContactItemBreakdown` from iOS. Used by
  /// `SavedReceiptView`'s expanded-row body.
  items: ContactItemShare[];
}

export interface ContactItemShare {
  itemId: string;
  description: string;
  /// How many contacts the item is split between.
  splitCount: number;
  /// This contact's share of the subtotal — already rounded
  /// to cents (matches iOS double-rounding semantics).
  amount: number;
}

export function calculateContactBreakdowns(
  items: ItemPayload[],
  assignmentsByItem: Map<string, string[]>,
  receipt: ReceiptPayload,
): ContactBreakdown[] {
  const subtotals = new Map<string, number>();
  const taxes = new Map<string, number>();
  const itemShares = new Map<string, ContactItemShare[]>();

  for (const item of items) {
    const contactIds = assignmentsByItem.get(item.id) ?? [];
    if (contactIds.length === 0) continue;
    const count = contactIds.length;
    const itemSubtotal = roundCents(item.price / count);
    const itemTax = roundCents(
      roundCents((item.price * (item.tax ?? 0)) / 100) / count,
    );
    for (const contactId of contactIds) {
      subtotals.set(contactId, (subtotals.get(contactId) ?? 0) + itemSubtotal);
      taxes.set(contactId, (taxes.get(contactId) ?? 0) + itemTax);
      const shares = itemShares.get(contactId) ?? [];
      shares.push({
        itemId: item.id,
        description: item.itemDescription,
        splitCount: count,
        amount: itemSubtotal,
      });
      itemShares.set(contactId, shares);
    }
  }

  const billSub = billSubtotal(items);
  const tipAmount = billTipAmount(receipt, billSub);

  const allIds = new Set<string>([...subtotals.keys(), ...taxes.keys()]);
  return Array.from(allIds).map((contactId) => {
    const subtotal = subtotals.get(contactId) ?? 0;
    const tax = taxes.get(contactId) ?? 0;
    const tip =
      billSub > 0 ? roundCents((tipAmount * subtotal) / billSub) : 0;
    return {
      contactId,
      subtotal,
      tax,
      tip,
      items: itemShares.get(contactId) ?? [],
    };
  });
}

/// Convenience: return a `Map<contactId, total>` ready to
/// drop into `ContactsRow.totalsByContact`. Total = subtotal
/// + tax + tip per the iOS view-model `total` derived field.
export function totalsByContactFromBreakdowns(
  breakdowns: ContactBreakdown[],
): Map<string, number> {
  const out = new Map<string, number>();
  for (const b of breakdowns) {
    out.set(b.contactId, b.subtotal + b.tax + b.tip);
  }
  return out;
}
