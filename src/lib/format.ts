/// Currency formatting shared across rows. Follows the locale
/// of the user's browser — same `Intl.NumberFormat` API the
/// iOS app uses via `formatCurrency` underneath
/// `NumberFormatter.currency`. Result is "$8.95" for USD,
/// "€8,95" for EUR-de, etc., locale-aware automatically.
export function formatCurrency(amount: number, currencyCode: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currencyCode,
  }).format(amount);
}

/// Tax-rate label like "7%" or "11.5%". Keeps trailing zeros
/// trimmed so we don't render "7.0%" when "7%" suffices.
export function formatTaxRate(taxRate: number): string {
  const trimmed = Number.isInteger(taxRate)
    ? taxRate.toString()
    : taxRate.toFixed(1).replace(/\.0$/, "");
  return `${trimmed}%`;
}

/// "May 4, 2026" — long month, numeric day, year. Matches the
/// pill in the iOS receipt-info card.
export function formatReceiptDate(epochMs: number, locale?: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(epochMs));
}

/// "9:07 AM" — h:mm with locale-driven AM/PM (or 24-hour where
/// appropriate). Matches the second pill in the iOS card.
export function formatReceiptTime(epochMs: number, locale?: string): string {
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(epochMs));
}

/// Returns the first letters of each name component capped at
/// two — used as the avatar placeholder when no photo is
/// available. e.g. "Camila Rivera" → "CR", "Liu" → "L".
export function initialsFor(fullName: string | null | undefined): string {
  if (!fullName) return "?";
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const letters = parts
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase());
  return letters.join("");
}
