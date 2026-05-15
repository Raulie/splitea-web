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

/// Combined "May 4, 2026 at 9:07 PM" — mirrors iOS Swift's
/// `displayDate.formatted(date: .long, time: .shortened)`.
/// `Intl.DateTimeFormat` with both date and time options
/// emits the locale-appropriate connector ("at" in en-US,
/// "à" in fr-FR, etc.) so we don't have to hardcode it.
/// Used in `SavedReceiptView`'s receipt-image section
/// caption — same format the iOS `receiptImageSection`
/// renders below the thumbnail.
export function formatReceiptDateTime(
  epochMs: number,
  options?: { includeTime?: boolean; locale?: string },
): string {
  const includeTime = options?.includeTime ?? true;
  return new Intl.DateTimeFormat(options?.locale, {
    month: "long",
    day: "numeric",
    year: "numeric",
    ...(includeTime
      ? {
          hour: "numeric",
          minute: "2-digit",
        }
      : {}),
  }).format(new Date(epochMs));
}

/// Formats a phone number for display. Mirrors iOS
/// `SpliteaContact.formattedPhoneNumber` which delegates to
/// `PhoneFormatter.shared.format()` — a libphonenumber-style
/// formatter backed by Google's metadata JSON. We don't
/// replicate that whole machinery on the web (the iOS-bundle
/// JSON is ~70KB and our SPA is ~22KB gzipped today), so this
/// covers the common cases:
///
///   • 10 digits, no country code → `(NNN) NNN-NNNN` (NANP /
///     US / Canada / Caribbean format used by ~all Splitea
///     test contacts so far)
///   • 11 digits starting with 1 → `+1 (NNN) NNN-NNNN`
///   • Other `+CC` prefixed → `+CC NNN NNN NNNN` (best-effort
///     space grouping by threes, since we don't have the
///     per-territory pattern metadata)
///   • Anything else → passthrough
///
/// TODO: bundle `libphonenumber-js/min` (~70KB) if non-NANP
/// numbers become a quality bar. The iOS formatter handles
/// every territory; the web side only handles +1 well today.
export function formatPhoneNumber(raw: string | null | undefined): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return trimmed;

  // 10-digit NANP without country code → `(XXX) XXX-XXXX`.
  if (!hasPlus && digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  // 11-digit starting with 1 (US/CA/etc) → `+1 (XXX) XXX-XXXX`.
  if (digits.length === 11 && digits.startsWith("1")) {
    const rest = digits.slice(1);
    return `+1 (${rest.slice(0, 3)}) ${rest.slice(3, 6)}-${rest.slice(6)}`;
  }
  // Explicit `+CC` international — best-effort space grouping.
  if (hasPlus) {
    // Country codes are 1-3 digits; we don't carry the lookup
    // table on the web. Treat the first 1-3 digits as the
    // country code by checking common ones; otherwise default
    // to a two-digit guess.
    let cc: string;
    if (digits.startsWith("1")) cc = "1";
    else if (/^(7|2[0-9]|3[0-9]|4[0-9]|5[0-9]|6[0-9]|8[0-9]|9[0-9])/.test(digits)) {
      cc = digits.slice(0, 2);
    } else {
      cc = digits.slice(0, 3);
    }
    const rest = digits.slice(cc.length);
    if (rest.length === 0) return `+${cc}`;
    // Split rest into groups of 3, last group taking the
    // remainder. e.g. `7875550001` → `787 555 0001`.
    const groups: string[] = [];
    let i = 0;
    while (i < rest.length) {
      const remaining = rest.length - i;
      const take = remaining <= 4 ? remaining : 3;
      groups.push(rest.slice(i, i + take));
      i += take;
    }
    return `+${cc} ${groups.join(" ")}`;
  }
  // Unknown shape — passthrough so we don't mangle.
  return trimmed;
}

/// Avatar placeholder when no photo is available. Mirrors iOS's
/// `SpliteaContact.initials`: first letter of the first word plus
/// first letter of the last word. e.g. "Camila Rivera" → "CR",
/// "María José García" → "MG", "Pedro Antonio Martínez" → "PM",
/// "Liu" → "L".
///
/// Taking first-and-last (instead of first-two) keeps middle
/// names from squeezing out the family initial, which matches
/// how iOS splits given/family before producing initials.
export function initialsFor(fullName: string | null | undefined): string {
  if (!fullName) return "?";
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0]!.toUpperCase();
  const first = parts[0][0]!.toUpperCase();
  const last = parts[parts.length - 1][0]!.toUpperCase();
  return first + last;
}

/// Builds the download filename basename (no extension) for a
/// receipt export, mirroring iOS's `downloadBaseName` in
/// `Splitea/Views/Receipt/Components/ReceiptFullscreenView.swift`
/// verbatim:
///
///   • Date: `yyyy-MM-dd` (en-US-POSIX, ISO order, locale-
///     independent so files sort the same on every device).
///   • With merchant: `Splitea - <Merchant> - <yyyy-MM-dd>`
///   • Without merchant: `Splitea Receipt - <yyyy-MM-dd>`
///   • Strips `/:\?%*|"<>` (illegal in Files.app / Finder /
///     iCloud Drive paths) by replacing each occurrence with
///     a single space, then collapses edge whitespace.
///   • Strips a leading `.` so the file isn't treated as a
///     hidden file by Files.app / Finder.
///
/// Pure function — no side effects, safe to call from render.
export function receiptDownloadBasename(
  merchantName: string | null | undefined,
  receiptDateMs: number | null | undefined,
): string {
  const date = receiptDateMs != null ? new Date(receiptDateMs) : new Date();
  // Format as yyyy-MM-dd in the device's local timezone (matches
  // iOS's `f.timeZone = .current`). Using `Intl` with en-US-POSIX
  // gives a stable ISO-style format regardless of user locale.
  const yyyy = String(date.getFullYear()).padStart(4, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const dateString = `${yyyy}-${mm}-${dd}`;

  const raw = merchantName?.trim();
  if (raw) {
    // Replace each illegal character with a space, then trim.
    // Matches the iOS `components(separatedBy:).joined(separator: " ")`
    // pattern. The character class `[/:\\?%*|"<>]` covers every
    // illegal char from the iOS list; escape `\` and `"` for the
    // JS regex literal.
    const cleaned = raw.replace(/[/:\\?%*|"<>]/g, " ").trim();
    // Strip leading dots so the file isn't hidden in Files.app /
    // Finder. iOS uses `drop(while: { $0 == "." })` — equivalent
    // to a `^\.+` regex strip.
    const safe = cleaned.replace(/^\.+/, "").trim();
    if (safe) return `Splitea - ${safe} - ${dateString}`;
  }
  return `Splitea Receipt - ${dateString}`;
}

/// Returns the file extension (no leading dot) for a receipt
/// `mimeType`. Mirrors iOS's "JPEG for image, PDF for PDF"
/// rule:
///   • `application/pdf` → `pdf`
///   • anything starting with `image/` → image subtype (e.g.
///     `jpeg` → `jpg`, `png` → `png`)
///   • fallback → `bin`
export function receiptDownloadExtension(mimeType: string): string {
  const m = mimeType.toLowerCase();
  if (m === "application/pdf" || m.endsWith("/pdf")) return "pdf";
  if (m.startsWith("image/")) {
    const sub = m.slice("image/".length);
    // iOS's `image.jpegData(...)` writes `.jpg`, not `.jpeg` —
    // match that for cross-platform consistency.
    if (sub === "jpeg" || sub === "jpg") return "jpg";
    return sub;
  }
  return "bin";
}
