import type { ItemPayload, ReceiptPayload } from "../types/snapshot";
import {
  billGrandTotal,
  billSubtotal,
  billTaxTotal,
  billTipAmount,
  minorUnitExponent,
  roundCents,
  type ContactBreakdown,
} from "./moneyMath";

export interface ConvertedBill {
  currencyCode: string;
  originalCurrencyCode: string;
  originalTotal: number;
  subtotal: number;
  tax: number;
  tip: number;
  grandTotal: number;
  rate: number;
  source: "card" | "market" | "custom";
  date: number | null;
  breakdowns: ContactBreakdown[];
}

/// Mirrors `CurrencyConversionMath.convert` on iOS: every amount is
/// converted and rounded on its own, then the person totals are
/// reconciled to the target with a largest-remainder pass so the
/// shares add up to what the card charged.
export function convertBill(
  receipt: ReceiptPayload,
  items: ItemPayload[],
  breakdowns: ContactBreakdown[],
): ConvertedBill | null {
  const to = receipt.settlementCurrencyCode;
  if (!to || to === receipt.currencyCode) return null;
  const grandTotal = billGrandTotal(receipt, items);
  const source: "card" | "market" | "custom" =
    receipt.fxSource === "market" || receipt.fxSource === "custom"
      ? receipt.fxSource
      : receipt.fxSource === "card"
        ? "card"
        : receipt.settlementTotal != null
          ? "card"
          : "market";
  let rate: number;
  let target: number;
  if (source === "card") {
    if (receipt.settlementTotal == null || receipt.settlementTotal <= 0) return null;
    target = receipt.settlementTotal;
    rate = grandTotal === 0 ? 0 : target / grandTotal;
  } else {
    if (receipt.fxRate == null || receipt.fxRate <= 0) return null;
    rate = receipt.fxRate;
    target = roundCents(grandTotal * rate, to);
  }

  const subtotal = billSubtotal(items);
  const tax = billTaxTotal(receipt, items);
  const tip = billTipAmount(receipt, subtotal, tax);
  let billSub = roundCents(subtotal * rate, to);
  let billTax = roundCents(tax * rate, to);
  let billTip = roundCents(tip * rate, to);
  const billResidue = roundCents(target - (billSub + billTax + billTip), to);
  if (tip > 0) billTip = roundCents(billTip + billResidue, to);
  else if (tax > 0) billTax = roundCents(billTax + billResidue, to);
  else billSub = roundCents(billSub + billResidue, to);

  const assignedOriginal = breakdowns.reduce((s, b) => s + b.subtotal + b.tax + b.tip, 0);
  const unassignedConverted = roundCents((grandTotal - assignedOriginal) * rate, to);
  const sharesTarget = breakdowns.length ? roundCents(target - unassignedConverted, to) : 0;

  const converted: ContactBreakdown[] = [];
  const remainders: { index: number; remainder: number }[] = [];
  breakdowns.forEach((b, index) => {
    const cSub = roundCents(b.subtotal * rate, to);
    const cTax = roundCents(b.tax * rate, to);
    const cTip = roundCents(b.tip * rate, to);
    const exact = (b.subtotal + b.tax + b.tip) * rate;
    remainders.push({ index, remainder: exact - (cSub + cTax + cTip) });
    converted.push({
      contactId: b.contactId,
      subtotal: cSub,
      tax: cTax,
      tip: cTip,
      items: b.items.map((i) => ({ ...i, amount: roundCents(i.amount * rate, to) })),
    });
  });

  const scale = 10 ** minorUnitExponent(to);
  const unit = 1 / scale;
  const sum = converted.reduce((s, b) => s + b.subtotal + b.tax + b.tip, 0);
  const residue = roundCents(sharesTarget - sum, to);
  if (converted.length && residue !== 0) {
    const steps = Math.round(Math.abs(residue) * scale);
    const ordered =
      residue > 0
        ? [...remainders].sort((a, b) => b.remainder - a.remainder)
        : [...remainders].sort((a, b) => a.remainder - b.remainder);
    const delta = residue > 0 ? unit : -unit;
    for (let step = 0; step < steps; step++) {
      const i = ordered[step % ordered.length].index;
      converted[i] = adjusted(converted[i], delta, to);
    }
  }

  return {
    currencyCode: to,
    originalCurrencyCode: receipt.currencyCode,
    originalTotal: grandTotal,
    subtotal: billSub,
    tax: billTax,
    tip: billTip,
    grandTotal: target,
    rate,
    source,
    date: receipt.fxRateDate ?? null,
    breakdowns: converted,
  };
}

function adjusted(b: ContactBreakdown, delta: number, currency: string): ContactBreakdown {
  if (b.tip > 0) return { ...b, tip: roundCents(b.tip + delta, currency) };
  if (b.tax > 0) return { ...b, tax: roundCents(b.tax + delta, currency) };
  const items = b.items.map((i) => ({ ...i }));
  let largest = -1;
  items.forEach((i, idx) => {
    if (largest < 0 || i.amount > items[largest].amount) largest = idx;
  });
  if (largest >= 0) items[largest].amount = roundCents(items[largest].amount + delta, currency);
  return { ...b, subtotal: roundCents(b.subtotal + delta, currency), items };
}

export function displayTotals(
  converted: ConvertedBill | null,
  fallback: Map<string, number>,
): Map<string, number> {
  if (!converted) return fallback;
  const out = new Map<string, number>();
  for (const b of converted.breakdowns) out.set(b.contactId, b.subtotal + b.tax + b.tip);
  return out;
}
