/// Web mirror of iOS `PaymentProvider` for the saved-receipt
/// "Pay" action. Holds the slug, display name, icon URL, and
/// a profile-URL builder per provider so the SPA can render
/// the payment-options modal and construct the right
/// destination URL when the user picks one.
///
/// Keep in sync with three iOS sources of truth:
///   - `Splitea/Models/PaymentProvider.swift` (enum cases +
///     `displayName`, `spliteaShareSlug`, `profileURL` per
///     case)
///   - `splitea-live/src/index.ts` (`PAY_PROVIDERS` registry,
///     hostname/scheme allowlist enforced by the worker)
///   - `splitea-live/src/payIcons.ts` (the icon PNG payloads,
///     served at `/p/<slug>/icon.png`)
///
/// We construct *profile* URLs (no amount) here, not full
/// payment URLs. The recipient enters the amount manually in
/// the payment app — they can see their breakdown total on
/// the same screen, so the friction is minimal, and we don't
/// need to know which contact the recipient is to construct
/// a per-recipient amount.

/// Raw values matching `PaymentProvider.rawValue` on iOS.
/// These are the keys used in `ContactPayload.paymentUsernames`.
export const PAY_PROVIDER_RAW_VALUES = [
  "venmo",
  "cashApp",
  "paypal",
  "revolut",
  "monzo",
  "googlePayUPI",
  "athMovil",
] as const;
export type PayProviderRawValue = (typeof PAY_PROVIDER_RAW_VALUES)[number];

export interface PayProvider {
  rawValue: PayProviderRawValue;
  /// Slug used in `splitea.app/p/<slug>/<b64u>`. Matches
  /// the worker's `PAY_PROVIDERS` registry keys.
  slug: string;
  displayName: string;
  /// Build a destination URL with NO amount prefilled —
  /// just the recipient's profile / payment-handle landing
  /// page. Useful when we don't know how much the visitor
  /// owes (e.g. they haven't picked an identity yet); the
  /// recipient enters the amount manually in the provider's
  /// app.
  profileURL(username: string): string;
  /// Build a destination URL with amount + note prefilled.
  /// Mirrors iOS `PaymentProvider.paymentURL(...)` in
  /// `Splitea/Models/PaymentProvider.swift`. Used once the
  /// recipient has identified themselves and we can scale
  /// the amount to their breakdown share. ATHM is the
  /// exception — its universal link doesn't take amount or
  /// note, so it returns the profile-URL form regardless.
  paymentURL(req: PaymentRequest): string;
}

/// Inputs for building an amount-prefilled payment URL.
/// `amount` is in MAJOR units (e.g. dollars, not cents);
/// the per-provider builder converts to whatever wire format
/// that provider expects (Revolut: integer cents).
export interface PaymentRequest {
  username: string;
  amount: number;
  currencyCode: string;
  merchantName: string | null;
}

/// Strip a leading `@` if present — Venmo accepts both
/// `@jdoe` and `jdoe` from users; the URL form expects no
/// leading `@`. Mirrors `PaymentProvider.normalizedVenmoUsername`.
function stripVenmoAt(u: string): string {
  return u.startsWith("@") ? u.slice(1) : u;
}

/// Format a decimal amount the way every provider's path-
/// based URL expects: 2 fractional digits, no thousands
/// separators, `.` as the decimal mark. Mirrors
/// `PaymentProvider.formatAmount(_:)`.
function formatAmount(amount: number): string {
  return amount.toFixed(2);
}

/// Convert a major-unit decimal (`25.99`) to its minor-unit
/// integer representation (`2599`). Required by Revolut's
/// `amount=<integer>` query item — confirmed by manual
/// testing that decimals are silently dropped. Same
/// behaviour iOS's `PaymentProvider.minorUnits(of:fractionDigits:)`
/// produces; we don't need bankers'-rounding precision on
/// web because the source amount is already a JS-number
/// rounded to 2 places by the breakdown calculator.
function minorUnits(amount: number, fractionDigits = 2): number {
  const factor = Math.pow(10, fractionDigits);
  return Math.round(amount * factor);
}

/// ASCII-fold a string — strip combining marks, replace
/// typographic punctuation (em-dash, smart quotes) with
/// ASCII equivalents, drop any remaining non-ASCII.
/// Mirrors the ASCII normalization in iOS's
/// `PaymentProvider.paymentNote(merchantName:)` — Venmo's
/// URL parser rejects multi-byte UTF-8 in note query
/// values with "URL is not valid", so we have to fold
/// down before encoding.
function asciiFold(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/—/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x00-\x7f]/g, "");
}

/// Build the "My share at <merchant>…" payment-memo note,
/// ASCII-folded for cross-provider compatibility.
///
/// First-person ("My") because in the web Pay flow the
/// VISITOR is the one writing the memo as part of paying
/// the sender back — "My share" is what they'd write on
/// their own. iOS uses "Your share" in
/// `PaymentProvider.paymentNote(merchantName:)` because
/// there the SENDER originates the request and addresses
/// it to the recipient ("YOUR share, [recipient]"); the
/// pronoun flips with the direction of initiation.
function paymentNote(merchantName: string | null | undefined): string {
  const raw =
    merchantName && merchantName.trim().length > 0
      ? `My share at ${merchantName.trim()} - sent via Splitea`
      : "My share of the bill - sent via Splitea";
  return asciiFold(raw);
}

/// `extractToken` parity for ATHM: the stored username may be
/// either the raw 32-byte hex ciphertext OR a full ATHM URL
/// (legacy save format). Pull out the hex either way.
/// Mirrors `ATHMovilQR.extractToken(from:)` for the cases
/// the web sees in practice.
export function extractAthmToken(input: string): string | null {
  const trimmed = input.trim();
  // Bare hex shortcut. ATHM tokens are AES-CBC ciphertext —
  // length is a multiple of 32, all hex chars.
  if (/^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length % 32 === 0) {
    return trimmed.toLowerCase();
  }
  // URL forms: pull the `content=` query item or the bare
  // query string. Recognized hosts: ATHM's S3 universal-link
  // host and Azure blob shim.
  try {
    const u = new URL(trimmed);
    const recognizedHosts = [
      "athm-ulink-prod-static-website.s3.amazonaws.com",
      "athmovil.blob.core.windows.net",
    ];
    if (!recognizedHosts.includes(u.hostname.toLowerCase())) return null;
    const content = u.searchParams.get("content");
    const candidate = content ?? u.search.replace(/^\?/, "");
    if (/^[0-9a-fA-F]+$/.test(candidate) && candidate.length % 32 === 0) {
      return candidate.toLowerCase();
    }
  } catch {
    // not a URL
  }
  return null;
}

/// Per-provider URL build: return the full ATHM universal
/// link for a stored username (which may be a bare hex
/// token or an already-built ATHM URL). Used by both
/// `profileURL` and `paymentURL` since ATHM's link form
/// has no amount/note slots.
function athmUniversalLink(username: string): string {
  const token = extractAthmToken(username);
  if (!token) return "https://athm-ulink-prod-static-website.s3.amazonaws.com/qr-code";
  return `https://athm-ulink-prod-static-website.s3.amazonaws.com/qr-code?content=${encodeURIComponent(token)}`;
}

/// All providers, in the order the modal renders them.
export const PAY_PROVIDERS: PayProvider[] = [
  {
    rawValue: "venmo",
    slug: "venmo",
    displayName: "Venmo",
    // `venmo.com/<user>` is the user's profile page; the
    // recipient hits "Pay or Request" there. The
    // amount-prefilled form uses Venmo's Quick Pay link
    // with `txn=charge&amount=...&note=...`. We hand-build
    // the query (not URLSearchParams) because Venmo's URL
    // router rejects `%20` in the note value — the docs
    // use form-urlencoded `+` for spaces, which works.
    profileURL: (u) => `https://venmo.com/${encodeURIComponent(stripVenmoAt(u))}`,
    // `txn=pay` (NOT `txn=charge`) because in the web Pay
    // flow the visitor IS the recipient who's settling
    // up — they're paying the sender, not requesting from
    // them. iOS's `BreakdownSectionsView` sends Venmo URLs
    // with `txn=charge` because there the SENDER is
    // requesting the recipient pay back; opposite
    // direction. Both end up moving money from recipient
    // → sender, but `txn=pay` shows "Pay <user> $25" in
    // Venmo while `txn=charge` shows "<user> is charging
    // you $25" — the former matches the action the
    // visitor actually initiated.
    paymentURL: ({ username, amount, merchantName }) => {
      const user = encodeURIComponent(stripVenmoAt(username));
      // Use standard `encodeURIComponent` (produces `%20` for
      // spaces) — NOT the legacy `formURLEncodeValue` which
      // converted spaces to `+`. Earlier comments here
      // claimed Venmo rejected `%20` in the note and required
      // form-urlencoded `+` instead. That's no longer true:
      // Venmo's current URL parser displays `+` LITERALLY in
      // the note field, so the iMessage preview shows
      // `My+share+at+La+Malcriada+-+sent+via+Splitea` when
      // tapped through. `%20` decodes to space correctly.
      const note = encodeURIComponent(paymentNote(merchantName));
      return `https://venmo.com/${user}?txn=pay&amount=${formatAmount(amount)}&note=${note}`;
    },
  },
  {
    rawValue: "cashApp",
    slug: "cashapp",
    displayName: "Cash App",
    // Cash App cashtags conventionally start with `$`; if
    // the user stored it without one, we add it. The
    // amount form is path-based: `cash.app/$tag/25.00`.
    profileURL: (u) => {
      const tag = u.startsWith("$") ? u : `$${u}`;
      return `https://cash.app/${encodeURIComponent(tag)}`;
    },
    paymentURL: ({ username, amount }) => {
      const tag = username.startsWith("$") ? username : `$${username}`;
      return `https://cash.app/${encodeURIComponent(tag)}/${formatAmount(amount)}`;
    },
  },
  {
    rawValue: "paypal",
    slug: "paypal",
    displayName: "PayPal",
    profileURL: (u) => `https://paypal.me/${encodeURIComponent(u)}`,
    // PayPal.me path syntax: `/<user>/<amount><currencyCode>`,
    // e.g. `paypal.me/jdoe/25.00USD`. Currency code
    // concatenated to the amount with no separator —
    // PayPal parses on the trailing 3-letter ISO suffix.
    paymentURL: ({ username, amount, currencyCode }) => {
      return `https://paypal.me/${encodeURIComponent(username)}/${formatAmount(amount)}${currencyCode.toUpperCase()}`;
    },
  },
  {
    rawValue: "revolut",
    slug: "revolut",
    displayName: "Revolut",
    profileURL: (u) => `https://revolut.me/${encodeURIComponent(u)}`,
    // revolut.me/<user>?amount=<cents>&currency=<ISO>&note=…
    // Three non-obvious quirks:
    //   1. `amount` is in MINOR UNITS (cents), NOT decimal
    //      — `$1.00` → `100`, `$0.01` → `1`. Decimals are
    //      silently dropped.
    //   2. Currency is a separate query item (uppercase ISO),
    //      NOT a path suffix concatenated to the amount as
    //      paypal.me does.
    //   3. The query MUST use `%20`-encoded spaces in the
    //      note, NOT form-urlencoded `+` — Revolut's parser
    //      ignores the entire URL with `+`-encoded notes.
    //      `URLSearchParams.toString()` emits `+` for
    //      spaces, so we hand-build the query with
    //      `encodeURIComponent` (which uses `%20`) to
    //      match iOS's `URLComponents` behavior exactly.
    paymentURL: ({ username, amount, currencyCode, merchantName }) => {
      const q = [
        `amount=${minorUnits(amount, 2)}`,
        `currency=${currencyCode.toUpperCase()}`,
        `note=${encodeURIComponent(paymentNote(merchantName))}`,
      ].join("&");
      return `https://revolut.me/${encodeURIComponent(username)}?${q}`;
    },
  },
  {
    rawValue: "monzo",
    slug: "monzo",
    displayName: "Monzo",
    profileURL: (u) => `https://monzo.me/${encodeURIComponent(u)}`,
    // monzo.me/<user>/<amount>?d=<note>. Same `%20`-vs-`+`
    // care as Revolut: encode by hand so spaces become
    // `%20`, matching iOS `URLComponents` output and
    // avoiding any provider-side parser pickiness.
    paymentURL: ({ username, amount, merchantName }) => {
      const note = encodeURIComponent(paymentNote(merchantName));
      return `https://monzo.me/${encodeURIComponent(username)}/${formatAmount(amount)}?d=${note}`;
    },
  },
  {
    rawValue: "googlePayUPI",
    slug: "gpay",
    displayName: "Google Pay",
    // UPI deep-link scheme. Browsers may not handle `upi://`
    // directly; the splitea.app/p/<slug>/<b64u> wrapper
    // serves an HTML page with a meta-refresh that the
    // browser hands to the OS, which routes it to a UPI
    // app if installed.
    profileURL: (u) => `upi://pay?pa=${encodeURIComponent(u)}`,
    // Hand-build for `%20`-encoded spaces (matches iOS
    // `URLComponents`); some UPI handlers reject `+`-
    // encoded note values the same way Revolut does.
    // UPI is INR-only at the protocol level; pinning `cu`
    // here matches iOS — recipients get the amount in
    // rupees regardless of receipt currency.
    paymentURL: ({ username, amount, merchantName }) => {
      const q = [
        `pa=${encodeURIComponent(username)}`,
        `pn=Splitea`,
        `am=${formatAmount(amount)}`,
        `cu=INR`,
        `tn=${encodeURIComponent(paymentNote(merchantName))}`,
      ].join("&");
      return `upi://pay?${q}`;
    },
  },
  {
    rawValue: "athMovil",
    slug: "athmovil",
    displayName: "ATH Móvil",
    // ATHM's universal link doesn't take amount or note
    // slots — the recipient enters the amount manually in
    // ATHM after the QR-driven payment screen opens. So
    // both `profileURL` and `paymentURL` return the same
    // form. Falls back to a placeholder when the stored
    // value doesn't parse — the worker will reject it as
    // out-of-allowlist anyway, and we don't want to throw
    // here (the modal would break for one bad config).
    profileURL: athmUniversalLink,
    paymentURL: ({ username }) => athmUniversalLink(username),
  },
];

const PROVIDER_BY_RAW: Record<string, PayProvider> = Object.fromEntries(
  PAY_PROVIDERS.map((p) => [p.rawValue, p]),
);

export function payProviderForRawValue(rawValue: string): PayProvider | undefined {
  return PROVIDER_BY_RAW[rawValue];
}

/// Wrap a destination URL into the Splitea rich-preview
/// shortlink form: `splitea.app/p/<slug>/<base64url-of-URL>`.
/// Matches `PaymentProvider.spliteaShareURL(destination:)` on
/// iOS and the worker's `/p/<slug>/<b64u>` route — the worker
/// validates the decoded host/scheme against its own
/// per-provider allowlist before redirecting.
export function spliteaShareURL(slug: string, destinationURL: string): string {
  const bytes = new TextEncoder().encode(destinationURL);
  // base64url: standard base64, swap +/ → -_, strip =.
  let b64 = "";
  for (const byte of bytes) b64 += String.fromCharCode(byte);
  const b64u = btoa(b64).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `https://splitea.app/p/${slug}/${b64u}`;
}

/// Filter the payer's `paymentUsernames` dictionary down to
/// providers we recognize and that have a non-empty username.
/// Preserves the order in `PAY_PROVIDERS`.
export function configuredPayProviders(
  paymentUsernames: Record<string, string> | null | undefined,
): { provider: PayProvider; username: string }[] {
  if (!paymentUsernames) return [];
  const out: { provider: PayProvider; username: string }[] = [];
  for (const provider of PAY_PROVIDERS) {
    const u = paymentUsernames[provider.rawValue];
    if (u && u.length > 0) out.push({ provider, username: u });
  }
  return out;
}
