import "./landing.css";
import { For, Show, createSignal, onCleanup, onMount } from "solid-js";
import { isServer } from "solid-js/web";
import { SpliteaMark } from "../../components/SpliteaMark";
import { DeviceFrame } from "../../components/DeviceFrame";
import { ItemsViewDemo } from "../ItemsView";
import { demoSnapshot } from "../../lib/demoSnapshot";
import { PRICES, appStoreUrl } from "./appStore";
import { type Copy } from "./copy/en";
import { LANDING_LOCALES, LandingProvider, copyFor, loadCopy, localeForSegment, pathFor, preferredLanding, localizedShot, type LandingLocale } from "./locales";
import { DemoGate } from "./DemoGate";
import { LocalNav } from "./LocalNav";
import { PinnedScene, type SceneStep } from "./PinnedScene";
import { reveal, smoothBehavior } from "./motion";
import { Accent, AppStoreBadge, PhoneShot, Pill, QrTile, ShotPicture, Tagline } from "./parts";

export const loadLandingCopy = (seg?: string) => loadCopy(localeForSegment(seg).code);

const TAX_ROWS: Record<string, { place: string; oldFashioned: string; mofongo: string }> = {
  oneLine: { place: "20.65%", oldFashioned: "48.6%", mofongo: "64.65%" },
  twoLines: { place: "22.9%", oldFashioned: "50.9%", mofongo: "66.95%" },
};

const taxRows = (locale: LandingLocale) =>
  ["es", "pt-br", "fr", "de", "it"].includes(locale.seg) ? TAX_ROWS.twoLines : TAX_ROWS.oneLine;

function buildSteps(copy: Copy, locale: LandingLocale): SceneStep[] {
  const pills = copy.how.pills;
  const rows = taxRows(locale);
  const pct = (n: number) =>
    new Intl.NumberFormat(locale.code === "es" ? "es-MX" : locale.code, { style: "percent", maximumFractionDigits: 1 }).format(n / 100);
  return [
  {
    ...copy.how.steps[0],
    screen: { shot: localizedShot("scan", locale) },
    pills: [],
  },
  {
    ...copy.how.steps[1],
    screen: {
      video: {
        hevc: "/landing/assign-v1.hevc.mp4",
        h264: "/landing/assign-v1.h264.mp4",
        first: { slug: "assign-first" },
        last: { slug: "assign-last" },
        tapAt: 1,
      },
    },
    pills: [
      { n: 1, text: pills.contact, top: "81.3%", side: "right" },
      { n: 2, text: pills.items, top: "40.75%", side: "left", late: true },
    ],
  },
  {
    ...copy.how.steps[2],
    screen: { shot: localizedShot("taxes", locale) },
    pills: [
      { text: pills.place, icon: "location", top: rows.place, side: "right" },
      { text: pills.oldFashioned, rate: pct(11.5), top: rows.oldFashioned, side: "left" },
      { text: pills.mofongo, rate: pct(7), top: rows.mofongo, side: "right" },
    ],
  },
  {
    ...copy.how.steps[3],
    screen: { shot: localizedShot("settle", locale) },
    pills: [
      { n: 1, text: pills.request, top: "6.5%", side: "right" },
      { n: 2, text: pills.paid, top: "90.7%", side: "left" },
    ],
  },
];
}

function SectionHead(props: { title: string; tagline?: string; body?: string; level?: "h2"; class?: string }) {
  return (
    <div class={`sec-head ${props.class ?? ""}`}>
      <h2 class="lp-h2" ref={reveal} style={{ "--i": 0 }}>
        <Accent text={props.title} />
      </h2>
      {props.tagline && <Tagline text={props.tagline} />}
      {props.body && (
        <p class="lp-body" ref={reveal} style={{ "--i": 1 }}>
          {props.body}
        </p>
      )}
    </div>
  );
}

function LangSuggest(props: { current: LandingLocale; dismiss: string }) {
  const [target, setTarget] = createSignal<LandingLocale>();
  const [atTop, setAtTop] = createSignal(true);
  const key = "lp-lang-suggest-dismissed";
  onMount(() => {
    const hero = document.getElementById("top");
    if (hero) {
      const io = new IntersectionObserver(([entry]) => setAtTop(entry.intersectionRatio > 0.35), { threshold: [0, 0.35, 1] });
      io.observe(hero);
      onCleanup(() => io.disconnect());
    }
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(key) === "1";
    } catch {
      dismissed = false;
    }
    const preferred = preferredLanding(navigator.languages?.length ? navigator.languages : [navigator.language]);
    if (!dismissed && preferred && preferred.code !== props.current.code) setTarget(preferred);
  });
  const close = () => {
    setTarget(undefined);
    try {
      localStorage.setItem(key, "1");
    } catch {
      return;
    }
  };
  return (
    <Show when={target()}>
      {(t) => (
        <div class="lang-suggest" classList={{ "is-away": !atTop() }} lang={t().code} inert={!atTop()}>
          <a href={pathFor(t())} rel="external" hreflang={t().hreflang}>
            {t().suggest}
          </a>
          <button type="button" aria-label={props.dismiss} onClick={close}>
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="m4.5 4.5 7 7m0-7-7 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
            </svg>
          </button>
        </div>
      )}
    </Show>
  );
}

export default function Landing(props: { lang?: string; params?: { lang?: string } }) {
  const locale = localeForSegment(props.lang ?? props.params?.lang);
  const copy = copyFor(locale.code);
  const steps = buildSteps(copy, locale);
  const snapshot = demoSnapshot();
  let heroBadge: HTMLDivElement | undefined;
  let regionRail: HTMLUListElement | undefined;
  const scrollRegions = (dir: number) => regionRail?.scrollBy({ left: dir * 272, behavior: smoothBehavior() });

  onMount(() => {
    const root = document.documentElement;
    const theme = document.querySelector('meta[name="theme-color"]');
    const scheme = document.querySelector('meta[name="color-scheme"]');
    const prevTheme = theme?.getAttribute("content");
    const prevScheme = scheme?.getAttribute("content");
    root.classList.add("landing");
    if (/Android/i.test(navigator.userAgent)) root.classList.add("is-android");
    theme?.setAttribute("content", "#EFE7D6");
    scheme?.setAttribute("content", "light");
    const press = () => {};
    document.addEventListener("touchstart", press, { passive: true });
    onCleanup(() => {
      document.removeEventListener("touchstart", press);
      root.classList.remove("landing", "is-android");
      if (prevTheme) theme?.setAttribute("content", prevTheme);
      if (prevScheme) scheme?.setAttribute("content", prevScheme);
    });
  });

  return (
    <LandingProvider value={{ copy, locale }}>
      <div class="lp" lang={locale.code}>
        <LocalNav watch={() => heroBadge} />
        <main>
          <section id="top" class="hero">
            <header class="hero-bar lp-container">
              <a class="hero-brand" href="#top">
                <SpliteaMark class="hero-mark" />
                <span>Splitea</span>
              </a>
              <nav class="hero-links" aria-label="Chapters">
                <For each={copy.nav.chapters}>{(c) => <a href={`#${c.id}`}>{c.label}</a>}</For>
              </nav>
            </header>

            <div class="hero-grid lp-container">
              <div class="hero-copy">
                <h1 class="lp-h1">
                  {copy.hero.titleTop}
                  <br />
                  <Accent text={copy.hero.titleBottom} />
                </h1>
                <Tagline text={copy.hero.tagline} />
                <p class="lp-body hero-body">{copy.hero.body}</p>
                <div class="hero-cta">
                  <div ref={heroBadge}>
                    <AppStoreBadge />
                  </div>
                  <p class="hero-note">
                    {copy.hero.noteTop}
                    <br />
                    {copy.hero.noteBottom}
                  </p>
                </div>
                <QrTile size={72} caption={copy.hero.qrCaption} class="hero-qr" />
                <p class="lp-android hero-android">{copy.hero.android}</p>
                <div class="hero-demo-note">
                  <p>{copy.hero.demoNote}</p>
                  <div class="hero-pills">
                    <Pill n={1} text={copy.hero.pills[0]} />
                    <Pill n={2} text={copy.hero.pills[1]} />
                  </div>
                </div>
              </div>

              <div class="hero-device">
                <DemoGate>
                  <DeviceFrame>
                    <div lang={locale.code} style={{ display: "contents" }}>
                      <Show when={!isServer}>
                        <ItemsViewDemo snapshot={snapshot} />
                      </Show>
                    </div>
                  </DeviceFrame>
                </DemoGate>
                <p class="hero-device-label">{copy.hero.demoLabel}</p>
              </div>
            </div>
          </section>

          <section id="how" class="sec how">
            <SectionHead title={copy.how.title} tagline={copy.how.tagline} body={copy.how.body} class="how-head lp-container" />
            <PinnedScene steps={steps} />
            <div class="scene-end">
              <p class="scene-end-title">{copy.how.endTitle}</p>
              <AppStoreBadge height={40} />
              <p class="lp-note">{copy.how.endNote}</p>
            </div>
          </section>

          <section id="send" class="sec send lp-container lp-split lp-split--5-7">
            <div>
              <SectionHead title={copy.send.title} tagline={copy.send.tagline} body={copy.send.body} />
              <p class="send-line">
                {copy.send.line} <a href="#top">{copy.send.tryIt}</a>
              </p>
            </div>
            <div class="send-visual">
              <div class="send-card reveal-msg" ref={reveal} style={{ "--i": 0 }}>
                <ShotPicture
                  shot={{ slug: "linkcard", widths: [480, 720] }}
                  sizes="(min-width:1024px) 340px, 78vw"
                  alt={copy.send.cardAlt}
                  width={1050}
                  height={1061}
                />
              </div>
              <div class="send-pills">
                <span class="reveal-msg" ref={reveal} style={{ "--i": 1 }}>
                  <Pill text={copy.send.connected} icon="dot" class="send-pill-a" />
                </span>
                <span class="reveal-msg" ref={reveal} style={{ "--i": 2 }}>
                  <Pill text={copy.send.anyBrowser} icon="globe" class="send-pill-b" />
                </span>
              </div>
            </div>
          </section>

          <section id="trips" class="sec trips lp-container lp-split lp-split--5-7">
            <SectionHead title={copy.trips.title} tagline={copy.trips.tagline} body={copy.trips.body} />
            <div class="mask">
              <div class="mask-window">
                <div class="mask-content">
                  <PhoneShot pw="var(--trips-pw)" class="trips-phone" label={copy.trips.alt}>
                    <ShotPicture shot={localizedShot("trip-folder", locale)} sizes="(min-width:1024px) 320px, 62vw" />
                  </PhoneShot>
                </div>
              </div>
            </div>
          </section>

          <section id="digital" class="sec digital lp-container lp-split lp-split--7-5">
            <SectionHead title={copy.digital.title} tagline={copy.digital.tagline} body={copy.digital.body} />
            <div class="digital-visual">
              <div class="digital-stack">
                <span class="reveal-rise" ref={reveal} style={{ "--i": 0 }}>
                  <Pill n={1} text={copy.digital.pills[0]} icon="share" />
                </span>
                <div class="digital-card">
                  <ShotPicture
                    shot={{ slug: "share-sheet-full", widths: [480, 720, 1080], webp: 1080 }}
                    sizes="(min-width:1024px) 440px, min(100vw - 40px, 360px)"
                    alt={copy.digital.alt}
                    width={1123}
                    height={1147}
                  />
                  <span class="digital-pill2 reveal-rise" ref={reveal} style={{ "--i": 1 }}>
                    <Pill n={2} text={copy.digital.pills[1]} />
                  </span>
                </div>
              </div>
            </div>
          </section>

          <section id="abroad" class="sec abroad">
            <div class="lp-container lp-split lp-split--7-5">
              <div>
                <SectionHead title={copy.abroad.title} tagline={copy.abroad.tagline} body={copy.abroad.body} />
                <p class="lp-body abroad-translate">
                  {copy.abroad.translateBefore}
                  <span class="cjk" lang={copy.abroad.translateExampleLang}>
                    {copy.abroad.translateExample}
                  </span>
                  {copy.abroad.translateAfter}
                </p>
              </div>
              <div class="abroad-phone">
                <PhoneShot pw="var(--fx-pw)" class="sd-screen" label={copy.abroad.alt}>
                  <ShotPicture shot={localizedShot("fx", locale)} sizes="(min-width:1024px) 320px, 62vw" />
                </PhoneShot>
              </div>
            </div>
            <div class="lp-container abroad-pay">
              <h3 class="lp-h3 abroad-pay-title">{copy.abroad.payTitle}</h3>
              <ul class="region-rail" ref={regionRail}>
                <For each={copy.abroad.regions}>
                  {(r) => (
                    <li class="region-card sd-rail-card">
                      <p class="region-title">{r.title}</p>
                      <p class="region-text">{r.text}</p>
                    </li>
                  )}
                </For>
              </ul>
              <div class="region-arrows">
                <button type="button" class="region-arrow" aria-label={copy.abroad.prev} onClick={() => scrollRegions(-1)}>
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <path d="m10 3-5 5 5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </button>
                <button type="button" class="region-arrow" aria-label={copy.abroad.next} onClick={() => scrollRegions(1)}>
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <path d="m6 3 5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </button>
              </div>
              <p class="lp-note abroad-foot">{copy.abroad.footnote}</p>
            </div>
          </section>

          <section id="privacy" class="sec privacy lp-ink">
            <div class="lp-container">
              <SectionHead title={copy.privacy.title} tagline={copy.privacy.tagline} body={copy.privacy.body} class="privacy-head" />
              <ul class="privacy-facts">
                <For each={copy.privacy.facts}>
                  {(f, i) => (
                    <li ref={reveal} class="reveal-rise" style={{ "--i": i() }}>
                      <p class="privacy-fact-title">{f.title}</p>
                      <p class="privacy-fact-text">{f.text}</p>
                    </li>
                  )}
                </For>
              </ul>
              <a class="privacy-link" rel="external" href="/legal/privacy">
                {copy.privacy.link}
              </a>
            </div>
          </section>

          <section id="pricing" class="sec pricing lp-container lp-split lp-split--7-5">
            <div>
              <SectionHead title={copy.pricing.title} tagline={copy.pricing.tagline} body={copy.pricing.body} />
              <p class="lp-note pricing-fine">{copy.pricing.fine}</p>
            </div>
            <div class="pricing-side">
              <div class="plan-card">
                <h3 class="plan-title">{copy.pricing.plan}</h3>
                <ul class="plan-checks">
                  <For each={copy.pricing.checks}>
                    {(c) => (
                      <li>
                        <svg viewBox="0 0 16 16" aria-hidden="true">
                          <path d="m3.2 8.4 3 3 6.6-6.8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                        </svg>
                        {c}
                      </li>
                    )}
                  </For>
                </ul>
                <p class="plan-price">{copy.pricing.price(PRICES.monthlyUS, PRICES.yearlyUS)}</p>
                <p class="lp-note">{copy.pricing.vary}</p>
              </div>
              <AppStoreBadge />
            </div>
          </section>

          <section id="faq" class="sec faq lp-container">
            <h2 class="lp-h2 faq-title" ref={reveal}>
              <Accent text={copy.faq.title} />
            </h2>
            <div class="faq-list">
              <For each={copy.faq.items}>
                {(item) => (
                  <details class="faq-item">
                    <summary>
                      <span>{item.q}</span>
                      <svg class="chev" viewBox="0 0 16 16" aria-hidden="true">
                        <path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                      </svg>
                    </summary>
                    <p>{item.a}</p>
                  </details>
                )}
              </For>
              <details class="faq-item">
                <summary>
                  <span>{copy.faq.dataQ}</span>
                  <svg class="chev" viewBox="0 0 16 16" aria-hidden="true">
                    <path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </summary>
                <p>
                  {copy.faq.dataBefore}
                  <a href="#privacy">{copy.faq.dataLink}</a>
                  {copy.faq.dataAfter}
                </p>
              </details>
            </div>
          </section>

          <section id="get" class="sec get">
            <div class="get-lockup">
              <SpliteaMark class="get-mark" />
              <p class="get-word">Splitea</p>
              <Show when={copy.get.pronunciation}>
              <p class="get-say">{copy.get.pronunciation}</p>
            </Show>
            </div>
            <div class="get-fan">
              <PhoneShot pw="var(--fan-pw-back)" class="get-phone get-phone--back sd-par-back" label={copy.get.listAlt}>
                <ShotPicture shot={localizedShot("library-list", locale)} sizes="(min-width:1024px) 300px, 46vw" />
              </PhoneShot>
              <PhoneShot pw="var(--fan-pw-front)" class="get-phone get-phone--front sd-par-front" label={copy.get.gridAlt}>
                <ShotPicture shot={localizedShot("library-grid", locale)} sizes="(min-width:1024px) 300px, 50vw" />
              </PhoneShot>
            </div>
            <div class="get-copy lp-container">
              <h2 class="lp-h2" ref={reveal}>
                <Accent text={copy.get.title} />
              </h2>
              <p class="lp-body">{copy.get.body}</p>
              <div class="get-cta">
                <AppStoreBadge />
                <QrTile size={120} caption={copy.get.qrCaption} class="get-qr" />
              </div>
              <p class="lp-note">{copy.get.small}</p>
              <Tagline text={copy.get.tagline} class="get-tagline" />
            </div>
          </section>
        </main>

        <footer class="lp-footer">
          <div class="lp-container lp-footer-row">
            <div class="lp-footer-brand">
              <SpliteaMark class="lp-footer-mark" />
              <span>{copy.footer.origin}</span>
            </div>
            <div class="lp-footer-links">
              <a rel="external" href="/legal/privacy">
                {copy.footer.privacy}
              </a>
              <a rel="external" href="/legal/terms">
                {copy.footer.terms}
              </a>
              <a href={appStoreUrl("landing")}>{copy.footer.appStore}</a>
            </div>
          </div>
          <nav class="lp-container lp-langs" aria-label={copy.footer.languages}>
            <ul>
              <For each={LANDING_LOCALES}>
                {(l) => (
                  <li>
                    <a
                      href={pathFor(l)}
                      rel="external"
                      lang={l.code}
                      hreflang={l.hreflang}
                      aria-current={l.code === locale.code ? "page" : undefined}
                    >
                      {l.name}
                    </a>
                  </li>
                )}
              </For>
            </ul>
          </nav>
          <div class="lp-container lp-footer-legal">
            <For each={copy.footer.legal}>{(l) => <p>{l}</p>}</For>
          </div>
        </footer>
        <LangSuggest current={locale} dismiss={copy.nav.dismiss} />
      </div>
    </LandingProvider>
  );
}
