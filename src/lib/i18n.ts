import { LOCALES, messages, type Locale, type MessageKey } from "../locales";

/// UI language for the share-link page.
///
/// A recipient opens this page from a text message, so there is no
/// account and no settings screen to read a preference from — the
/// browser's own language list is the only signal, and it is
/// available synchronously, which lets the first paint already be
/// in the right language. The locale never changes after load, so
/// `t` is a plain function rather than a signal or a context.
///
/// Number, currency and date formatting deliberately stay on the
/// browser's locale (see `format.ts`) rather than this one: someone
/// running an English phone in Germany should read English copy but
/// still see "18,90 €" the way their device writes it.

const FALLBACK: Locale = "en";

/// `navigator.language` gives tags like `de`, `de-AT`, `pt-PT`,
/// `zh-Hans-CN`, `zh-TW`. Match the most specific supported locale
/// each one implies.
function match(tag: string): Locale | null {
  const lower = tag.toLowerCase();
  const parts = lower.split("-");
  const base = parts[0];

  if (base === "zh") {
    // Script subtag wins when present; otherwise infer from region.
    // Taiwan, Hong Kong and Macau write Traditional.
    if (parts.includes("hant")) return "zh-Hant";
    if (parts.includes("hans")) return "zh-Hans";
    if (parts.some((p) => p === "tw" || p === "hk" || p === "mo")) return "zh-Hant";
    return "zh-Hans";
  }
  // Only Brazilian Portuguese ships; pt-PT readers get it too, which
  // is far closer than falling through to English.
  if (base === "pt") return "pt-BR";

  const exact = LOCALES.find((l) => l.toLowerCase() === lower);
  if (exact) return exact;
  const byBase = LOCALES.find((l) => l.toLowerCase() === base);
  return byBase ?? null;
}

function resolve(): Locale {
  // `?lang=` overrides everything. It exists so support and the App
  // Store screenshot pipeline can pin a language without reconfiguring
  // the whole device; an unrecognised value is ignored rather than
  // failing the page.
  try {
    const forced = new URLSearchParams(window.location.search).get("lang");
    if (forced) {
      const m = match(forced);
      if (m) return m;
    }
  } catch {
    /* no window.location in a non-browser context — fall through */
  }

  const tags = navigator.languages?.length
    ? navigator.languages
    : [navigator.language].filter(Boolean);
  for (const tag of tags) {
    const m = match(tag);
    if (m) return m;
  }
  return FALLBACK;
}

export const locale: Locale = resolve();

/// Tell the document what language it is in. Drives `:lang()` font
/// selection in `index.css` — without it, Chinese text renders with
/// Japanese glyph forms — and lets VoiceOver pick the right voice.
export function applyDocumentLanguage() {
  document.documentElement.lang = locale;
}

/// Look up a string, substituting `{name}`-style placeholders.
/// Missing keys fall back to English and then to the key itself, so
/// a gap degrades to readable text rather than a blank element.
export function t(
  key: MessageKey,
  params?: Record<string, string | number>,
): string {
  const table = messages[locale] ?? messages[FALLBACK];
  let out: string = table[key] ?? messages[FALLBACK][key] ?? key;
  if (params) {
    for (const name in params) {
      out = out.split(`{${name}}`).join(String(params[name]));
    }
  }
  return out;
}
