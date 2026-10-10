import { createContext, useContext } from "solid-js";
import { en, type Copy } from "./copy/en";

export type LandingLocale = {
  code: string;
  seg: string;
  hreflang: string;
  og: string;
  name: string;
  suggest: string;
  badgeWidth: number;
};

export const LANDING_LOCALES: LandingLocale[] = [
  { code: "en", seg: "", hreflang: "en", og: "en_US", name: "English", suggest: "View this page in English", badgeWidth: 119.66407 },
  { code: "es", seg: "es", hreflang: "es", og: "es_LA", name: "Español", suggest: "Ver esta página en español", badgeWidth: 119.66407 },
  { code: "pt-BR", seg: "pt-br", hreflang: "pt-BR", og: "pt_BR", name: "Português", suggest: "Ver esta página em português", badgeWidth: 119.66407 },
  { code: "fr", seg: "fr", hreflang: "fr", og: "fr_FR", name: "Français", suggest: "Voir cette page en français", badgeWidth: 126.50751 },
  { code: "de", seg: "de", hreflang: "de", og: "de_DE", name: "Deutsch", suggest: "Diese Seite auf Deutsch ansehen", badgeWidth: 119.66407 },
  { code: "it", seg: "it", hreflang: "it", og: "it_IT", name: "Italiano", suggest: "Vedi questa pagina in italiano", badgeWidth: 119.66407 },
  { code: "ja", seg: "ja", hreflang: "ja", og: "ja_JP", name: "日本語", suggest: "このページを日本語で見る", badgeWidth: 108.85157 },
  { code: "ko", seg: "ko", hreflang: "ko", og: "ko_KR", name: "한국어", suggest: "이 페이지를 한국어로 보기", badgeWidth: 129.70071 },
  { code: "zh-Hans", seg: "zh-hans", hreflang: "zh-Hans", og: "zh_CN", name: "简体中文", suggest: "查看本页的简体中文版", badgeWidth: 108.85157 },
  { code: "zh-Hant", seg: "zh-hant", hreflang: "zh-Hant", og: "zh_TW", name: "繁體中文", suggest: "查看本頁的繁體中文版", badgeWidth: 108.85157 },
];

export function preferredLanding(tags: readonly string[]): LandingLocale | undefined {
  for (const tag of tags) {
    const parts = tag.toLowerCase().split("-");
    const base = parts[0];
    if (base === "zh") {
      const hant = parts.includes("hant") || parts.some((p) => p === "tw" || p === "hk" || p === "mo");
      return LANDING_LOCALES.find((l) => l.code === (hant ? "zh-Hant" : "zh-Hans"));
    }
    if (base === "pt") return LANDING_LOCALES.find((l) => l.code === "pt-BR");
    const hit = LANDING_LOCALES.find((l) => l.code.toLowerCase() === base);
    if (hit) return hit;
  }
  return undefined;
}

export const badgeSrc = (l: LandingLocale) => `/badges/app-store-${l.seg || "en-us"}-black-v1.svg`;

export const pathFor = (l: LandingLocale) => (l.seg ? `/${l.seg}/` : "/");

export const localeForSegment = (seg: string | undefined) =>
  LANDING_LOCALES.find((l) => l.seg === (seg ?? "").toLowerCase()) ?? LANDING_LOCALES[0];

const cache: Record<string, Copy> = { en };

const loaders: Record<string, () => Promise<{ default: Copy }>> = {
  es: () => import("./copy/es"),
  "pt-BR": () => import("./copy/pt-BR"),
  fr: () => import("./copy/fr"),
  de: () => import("./copy/de"),
  it: () => import("./copy/it"),
  ja: () => import("./copy/ja"),
  ko: () => import("./copy/ko"),
  "zh-Hans": () => import("./copy/zh-Hans"),
  "zh-Hant": () => import("./copy/zh-Hant"),
};

export async function loadCopy(code: string): Promise<Copy> {
  if (cache[code]) return cache[code];
  const load = loaders[code];
  if (!load) return en;
  const mod = await load();
  cache[code] = mod.default;
  return mod.default;
}

export function registerCopy(code: string, copy: Copy) {
  cache[code] = copy;
}

export const copyFor = (code: string): Copy => cache[code] ?? en;

const LOCALIZED_SHOTS = new Set(["scan", "taxes", "settle", "trip-dc", "fx", "library-grid", "library-list"]);

export const localizedShot = (slug: string, locale: LandingLocale) =>
  locale.seg && LOCALIZED_SHOTS.has(slug) ? { slug: `${slug}-${locale.seg}`, widths: [480, 720] } : { slug };

const LandingContext = createContext<{ copy: Copy; locale: LandingLocale }>({ copy: en, locale: LANDING_LOCALES[0] });

export const LandingProvider = LandingContext.Provider;

export const useLanding = () => useContext(LandingContext);
