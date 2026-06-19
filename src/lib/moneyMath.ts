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

/// Largest-remainder (Hamilton) distribution of a cent-quantized
/// `total` across `weights`, so the returned shares sum EXACTLY to
/// `total`. Each share is floor(total * w / Σw) cents; leftover
/// cents go to the largest fractional remainders (ties by index).
/// All-zero weights fall back to an even split. Verbatim port of
/// `distributeCents` in `Services/MoneyMath.swift`.
export function distributeCents(total: number, weights: number[]): number[] {
  const n = weights.length;
  if (n === 0) return [];
  const totalCents = Math.round(centsOf(total));
  const weightSum = weights.reduce((s, w) => s + w, 0);
  if (weightSum <= 0) {
    const base = Math.floor(totalCents / n);
    const rem = totalCents - base * n;
    return weights.map((_, i) => (base + (i < rem ? 1 : 0)) / 100);
  }
  const floors: number[] = [];
  const remainders: { i: number; r: number }[] = [];
  let allocated = 0;
  for (let i = 0; i < n; i++) {
    const exact = (totalCents * weights[i]!) / weightSum;
    const fl = Math.floor(exact);
    floors.push(fl);
    remainders.push({ i, r: exact - fl });
    allocated += fl;
  }
  const leftover = totalCents - allocated;
  remainders.sort((a, b) => (b.r !== a.r ? b.r - a.r : a.i - b.i));
  for (let k = 0; k < leftover && k < remainders.length; k++) {
    floors[remainders[k]!.i]!++;
  }
  return floors.map((c) => c / 100);
}

/// Left-rotates `arr` by `offset` (mod length). Mirror of iOS `rotated`.
function rotated<T>(arr: T[], offset: number): T[] {
  if (arr.length <= 1) return arr;
  const k = ((offset % arr.length) + arr.length) % arr.length;
  return k === 0 ? arr : [...arr.slice(k), ...arr.slice(0, k)];
}

/// Per-item rotation offsets that spread the largest-remainder leftover
/// cents evenly across participants instead of always landing them on
/// the lowest-id person. Walks items in canonical id order with a
/// running carry advanced by each item's leftover-cent count, so an
/// even split comes out within a cent per person. MUST stay identical
/// to iOS `itemLeftoverRotations` and splitea-shares.
function itemLeftoverRotations(
  items: ItemPayload[],
  assignmentsByItem: Map<string, string[]>,
): Map<string, number> {
  const rotations = new Map<string, number>();
  let carry = 0;
  const sorted = [...items].sort((a, b) =>
    a.id.toLowerCase() < b.id.toLowerCase() ? -1 : 1,
  );
  for (const item of sorted) {
    const count = assignmentsByItem.get(item.id)?.length ?? 0;
    if (count === 0) continue;
    rotations.set(item.id, carry % count);
    const totalCents = Math.round(centsOf(item.price));
    carry += ((totalCents % count) + count) % count;
  }
  return rotations;
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
  | "per_rate_group_up"
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
    case "per_rate_group_up":
      // Each rate group's tax ceiled independently — matches POS
      // systems (e.g. Puerto Rico IVU) that round up per group.
      return groupedByRate(items).reduce(
        (sum, g) => sum + roundCentsUp((g.subtotal * g.rate) / 100),
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

/// The single tax rate shared by every taxed item, or null when rates
/// are mixed (or there are none). Mirrors iOS
/// `BillSummarySection.displayRate`'s per-item branch — drives showing
/// the rate once in the "Tax (X%)" summary and dropping the redundant
/// per-row tax badge.
export function uniformItemRate(items: ItemPayload[]): number | null {
  const rates = [
    ...new Set(
      items
        .map((i) => i.tax)
        .filter((t): t is number => t !== null && t !== undefined && t > 0),
    ),
  ];
  return rates.length === 1 ? rates[0] : null;
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
/// the bill subtotal (plus tax when `tipPostTax`) and round
/// half-up to cents — matches iOS `BillSplitViewModel.tipAmount`;
/// `amount` types pass through verbatim — iOS doesn't re-round a
/// user-typed dollar value.
export function billTipAmount(
  receipt: ReceiptPayload,
  subtotal: number,
  taxTotal: number,
): number {
  if (receipt.tipType === "percentage") {
    const base = receipt.tipPostTax ? subtotal + taxTotal : subtotal;
    return roundCents((base * receipt.tipValue) / 100);
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
  const tip = billTipAmount(receipt, sub, tax);
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

/// Removes negative cents in `arr` by shifting a cent from the largest
/// element, preserving the array's sum. Mirror of iOS `clampNonNegative`.
function clampNonNegative(arr: number[]): void {
  let guardN = 0;
  while (guardN < 50) {
    let minI = 0;
    let maxI = 0;
    for (let i = 1; i < arr.length; i++) {
      if (arr[i]! < arr[minI]!) minI = i;
      if (arr[i]! > arr[maxI]!) maxI = i;
    }
    if (arr[minI]! >= 0 || minI === maxI || arr[maxI]! <= 0) break;
    arr[minI]!++;
    arr[maxI]!--;
    guardN++;
  }
}

/// Splits each person's `nonSub` (tax+tip share, in cents) into a reconciled
/// line (`recon`, which already sums to its receipt total) and a derived line
/// (`nonSub - recon`). Cents are shifted within the reconciled line so the
/// derived line never goes negative. Mirror of iOS `splitNonSub`.
function splitNonSub(
  nonSub: number[],
  recon: number[],
): { recon: number[]; derived: number[] } {
  const r = [...recon];
  const d = nonSub.map((v, i) => v - (r[i] ?? 0));
  const limit = 20 * Math.max(1, nonSub.length);
  let guardN = 0;
  while (guardN < limit) {
    let minI = 0;
    let maxI = 0;
    for (let i = 1; i < d.length; i++) {
      if (d[i]! < d[minI]!) minI = i;
      if (d[i]! > d[maxI]!) maxI = i;
    }
    if (d[minI]! >= 0) break;
    if (r[minI]! <= 0 || minI === maxI || d[maxI]! <= 0) break;
    r[minI]!--;
    d[minI]!++;
    r[maxI]!++;
    d[maxI]!--;
    guardN++;
  }
  clampNonNegative(r);
  clampNonNegative(d);
  return { recon: r, derived: d };
}

export function calculateContactBreakdowns(
  items: ItemPayload[],
  assignmentsByItem: Map<string, string[]>,
  receipt: ReceiptPayload,
): ContactBreakdown[] {
  const subtotals = new Map<string, number>();
  const taxWeights = new Map<string, number>();
  // Scaled-integer "exact share" weights for the grand-total split.
  const subWeight = new Map<string, number>();
  const taxWeight = new Map<string, number>();
  const itemShares = new Map<string, ContactItemShare[]>();

  // Viewer-independent order (by lowercased contact id) so the
  // largest-remainder split lands the leftover cent on the SAME
  // person on every client (iOS / web / shares).
  const byId = (ids: string[]) =>
    [...ids].sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1));

  const rotations = itemLeftoverRotations(items, assignmentsByItem);

  for (const item of items) {
    const contactIds = assignmentsByItem.get(item.id) ?? [];
    if (contactIds.length === 0) continue;
    const ordered = rotated(byId(contactIds), rotations.get(item.id) ?? 0);
    const count = ordered.length;
    // Largest-remainder split of the item subtotal and its rounded
    // tax so each item's shares sum EXACTLY to the item totals.
    const subtotalShares = distributeCents(item.price, new Array(count).fill(1));
    const itemTaxTotal = roundCents((item.price * (item.tax ?? 0)) / 100);
    const taxSplit = distributeCents(itemTaxTotal, new Array(count).fill(1));
    const priceCents = Math.round(centsOf(item.price));
    const taxCents = Math.round(centsOf(itemTaxTotal));
    const subPartItem = Math.floor(priceCents / count);
    const taxPartItem = Math.floor(taxCents / count);
    ordered.forEach((contactId, index) => {
      const sub = subtotalShares[index] ?? 0;
      subtotals.set(contactId, (subtotals.get(contactId) ?? 0) + sub);
      taxWeights.set(
        contactId,
        (taxWeights.get(contactId) ?? 0) + (taxSplit[index] ?? 0),
      );
      subWeight.set(contactId, (subWeight.get(contactId) ?? 0) + subPartItem);
      taxWeight.set(contactId, (taxWeight.get(contactId) ?? 0) + taxPartItem);
      const shares = itemShares.get(contactId) ?? [];
      shares.push({
        itemId: item.id,
        description: item.itemDescription,
        splitCount: count,
        amount: sub,
      });
      itemShares.set(contactId, shares);
    });
  }

  const billSub = billSubtotal(items);
  const taxTotal = calculateTaxTotal(
    items,
    receipt.taxRoundingMethod as TaxRoundingMethod,
  );
  const tipAmount = billTipAmount(receipt, billSub, taxTotal);

  const order = Array.from(
    new Set<string>([...subtotals.keys(), ...taxWeights.keys()]),
  ).sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1));

  // Grand-total reconciliation: distribute the WHOLE bill once (weighted by
  // each person's floored exact share, equal on an even split) so per-person
  // totals differ by at most a cent, then back out the tax/tip lines so they
  // still sum to the receipt totals. MUST stay identical to iOS / shares.
  const taxByContact = new Map<string, number>();
  const tipByContact = new Map<string, number>();
  const taxTotalCents = Math.round(centsOf(taxTotal));
  const tipTotalCents = Math.round(centsOf(tipAmount));

  if (taxTotalCents === 0 && tipTotalCents === 0) {
    for (const id of order) {
      taxByContact.set(id, 0);
      tipByContact.set(id, 0);
    }
  } else {
    const grandTotal = billSub + taxTotal + tipAmount;
    const gtWeights = order.map(
      (id) => (subWeight.get(id) ?? 0) + (taxWeight.get(id) ?? 0),
    );
    const gshare = distributeCents(grandTotal, gtWeights);
    const subsCents = order.map((id) => Math.round(centsOf(subtotals.get(id) ?? 0)));
    const gshareCents = gshare.map((v) => Math.round(centsOf(v)));
    const nonSub = order.map((_, i) => gshareCents[i]! - subsCents[i]!);

    let taxC: number[];
    let tipC: number[];
    if (tipTotalCents >= taxTotalCents) {
      const recon = distributeCents(
        taxTotal,
        order.map((id) => taxWeights.get(id) ?? 0),
      ).map((v) => Math.round(centsOf(v)));
      const split = splitNonSub(nonSub, recon);
      taxC = split.recon;
      tipC = split.derived;
    } else {
      const recon = distributeCents(
        tipAmount,
        order.map((id) => subtotals.get(id) ?? 0),
      ).map((v) => Math.round(centsOf(v)));
      const split = splitNonSub(nonSub, recon);
      tipC = split.recon;
      taxC = split.derived;
    }
    order.forEach((id, i) => {
      taxByContact.set(id, (taxC[i] ?? 0) / 100);
      tipByContact.set(id, (tipC[i] ?? 0) / 100);
    });
  }

  return order.map((contactId) => ({
    contactId,
    subtotal: subtotals.get(contactId) ?? 0,
    tax: taxByContact.get(contactId) ?? 0,
    tip: tipByContact.get(contactId) ?? 0,
    items: itemShares.get(contactId) ?? [],
  }));
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
