import "./landing.css";
import { For, Show, createEffect, createSignal, onCleanup, onMount } from "solid-js";
import { isServer } from "solid-js/web";
import { DeviceFrame } from "../../components/DeviceFrame";
import { ItemsViewDemo } from "../ItemsView";
import { DEMO_SNAPSHOT, demoSnapshot } from "../../lib/demoSnapshot";
import { calculateContactBreakdowns } from "../../lib/moneyMath";
import { PRICES_US, appStoreUrl } from "./appStore";
import { LANDING_LOCALES, LandingProvider, copyFor, loadCopy, localeForSegment, pathFor, preferredLanding, localizedShot, type LandingLocale } from "./locales";
import { DemoGate } from "./DemoGate";
import { LocalNav, PauseButton } from "./LocalNav";
import { fitGiants } from "./fit";
import { Accent, AppStoreBadge, MailLinks, MarkPieces, Phone, Phrases, QrTile, Seal, ShotPicture, foldDetails, plain, type BubbleAnchor, type Shot } from "./parts";

export const loadLandingCopy = (seg?: string) => loadCopy(localeForSegment(seg).code);

const TAX_ROWS: Record<string, { oldFashioned: number; mofongo: number }> = {
  oneLine: { oldFashioned: 49.5, mofongo: 66 },
  twoLines: { oldFashioned: 51.8, mofongo: 68.3 },
};

const PAY_MENU_TOP: Record<string, number> = { en: 69, es: 68, fr: 71.5, de: 71.5, it: 77 };
const FX_ROW_Y: Record<string, number> = { es: 59.2, fr: 59.2, "pt-BR": 59.2, "zh-Hans": 59.3, "zh-Hant": 59.3 };

const [MARISOL, ANDRES, NINA] = DEMO_SNAPSHOT.contacts;
const ITEMS = DEMO_SNAPSHOT.items;
const FULL_ASSIGN = (() => {
  const map = new Map<string, string[]>();
  for (const a of DEMO_SNAPSHOT.assignments) map.set(a.itemId, [...(map.get(a.itemId) ?? []), a.contactId]);
  map.set(ITEMS[3].id, [ANDRES.id]);
  map.set(ITEMS[5].id, [NINA.id]);
  return map;
})();
const BREAKDOWNS = calculateContactBreakdowns(ITEMS, FULL_ASSIGN, DEMO_SNAPSHOT.receipt);
const cents = (n: number) => Math.round(n * 100) / 100;
const shareOf = (id: string) => {
  const b = BREAKDOWNS.find((x) => x.contactId === id)!;
  return cents(b.subtotal + b.tax + b.tip);
};
const SUBTOTAL = cents(ITEMS.reduce((s, i) => s + i.price, 0));
const TAX = cents(ITEMS.reduce((s, i) => s + (i.taxAmount ?? 0), 0));
const TIP = cents(SUBTOTAL * (DEMO_SNAPSHOT.receipt.tipValue / 100));
const TOTAL = cents(SUBTOTAL + TAX + TIP);
const SHARES = [MARISOL, ANDRES, NINA].map((c) => ({ name: c.fullName!.split(" ")[0], amount: shareOf(c.id), avatar: c.avatarUrl! }));
const OWED = cents(SHARES[1].amount + SHARES[2].amount);
const andresItems = BREAKDOWNS.find((x) => x.contactId === ANDRES.id)!.items;

const numberLocale = (l: LandingLocale) => (l.code === "es" ? "es-MX" : l.code);

const settleShots = (l: LandingLocale) => {
  const seg = l.seg;
  const shot = (slug: string): Shot => (seg ? { slug: `${slug}-${seg}`, widths: [480, 720] } : { slug });
  return { closed: shot("settle2"), menu: shot("settlemenu") };
};

function LangSuggest(props: { current: LandingLocale; dismiss: string }) {
  const [target, setTarget] = createSignal<LandingLocale>();
  const [atTop, setAtTop] = createSignal(true);
  const key = "lp-lang-suggest-dismissed";
  onMount(() => {
    const onScroll = () => setAtTop(window.scrollY < 6);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    onCleanup(() => window.removeEventListener("scroll", onScroll));
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(key) === "1";
    } catch {
      dismissed = false;
    }
    const preferred = preferredLanding(navigator.languages?.length ? navigator.languages : [navigator.language]);
    if (!dismissed && preferred && preferred.code !== props.current.code) setTarget(preferred);
  });
  onMount(() => {
    createEffect(() => document.documentElement.classList.toggle("lp-suggesting", !!target()));
    onCleanup(() => document.documentElement.classList.remove("lp-suggesting"));
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

function Stamp(props: { text: string; dark?: boolean }) {
  return <span class={`lp-stamp lp-label ${props.dark ? "lp-stamp-dark" : ""}`}>{props.text}</span>;
}

export default function Landing(props: { lang?: string; params?: { lang?: string } }) {
  const locale = localeForSegment(props.lang ?? props.params?.lang);
  const copy = copyFor(locale.code);
  const v2 = copy.v2;
  const snapshot = demoSnapshot();
  const money = new Intl.NumberFormat(numberLocale(locale), { style: "currency", currency: "USD" });
  const receiptFmt = new Intl.NumberFormat(numberLocale(locale), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const receiptNum = (n: number) => receiptFmt.format(n);
  const pct = (n: number) => new Intl.NumberFormat(numberLocale(locale), { style: "percent", maximumFractionDigits: 1 }).format(n / 100);
  const twoLineHeader = ["es", "pt-br", "fr", "de", "it"].includes(locale.seg);
  const rows = twoLineHeader ? TAX_ROWS.twoLines : TAX_ROWS.oneLine;
  const assignSuffix = locale.seg ? `-${locale.seg}` : "";
  const glossEnd = copy.abroad.translateAfter.search(/[)）]/) + 1;
  const translateGloss = copy.abroad.translateAfter.slice(0, glossEnd);
  const translateRest = copy.abroad.translateAfter.slice(glossEnd);
  const menuTop = PAY_MENU_TOP[locale.code];
  const hasMenu = menuTop !== undefined;
  const settle = settleShots(locale);
  const chapter = (id: string) => copy.nav.chapters.find((c) => c.id === id)?.label ?? "";
  const [paused, setPaused] = createSignal(false);
  let root: HTMLDivElement | undefined;

  const togglePause = () => {
    const next = !paused();
    setPaused(next);
    document.documentElement.classList.toggle("lp-paused", next);
    try {
      localStorage.setItem("lp-motion-paused", next ? "1" : "0");
    } catch {
      return;
    }
  };

  const tapBubbles: BubbleAnchor[] = [
    { y: twoLineHeader ? 82.6 : 81.3, x: -20, side: "r", n: 1, text: copy.how.pills.contact, tilt: 0 },
    { y: twoLineHeader ? 46.8 : 44.5, x: 4, side: "l", n: 2, text: copy.how.pills.items, tilt: 0 },
  ];
  const taxBubbles: BubbleAnchor[] = [
    { y: rows.oldFashioned, x: -9, side: "l", text: `${copy.how.pills.oldFashioned} ${pct(11.5)}`, tone: "terra", tilt: 0 },
    { y: rows.mofongo, x: -9, side: "r", text: `${copy.how.pills.mofongo} ${pct(7)}`, tone: "terra", tilt: 2 },
  ];
  const payBubbles: BubbleAnchor[] = hasMenu
    ? [
        { y: 89, x: 50, side: "c", n: 1, text: v2.how.payTap, tilt: -2 },
        { y: menuTop + 2.8, x: 50, side: "c", n: 2, text: v2.how.payPick, tilt: -3, later: true },
      ]
    : [
        { y: 6.5, x: -9, side: "r", n: 1, text: copy.how.pills.request, tilt: 2 },
        { y: 90.7, x: -9, side: "l", n: 2, text: copy.how.pills.paid, tilt: -2 },
      ];

  onMount(() => {
    const html = document.documentElement;
    const theme = document.querySelector('meta[name="theme-color"]');
    const scheme = document.querySelector('meta[name="color-scheme"]');
    const prevTheme = theme?.getAttribute("content");
    const prevScheme = scheme?.getAttribute("content");
    html.classList.add("landing");
    if (/Android/i.test(navigator.userAgent)) html.classList.add("is-android");
    theme?.setAttribute("content", "#EFE7D6");
    scheme?.setAttribute("content", "light");
    const press = () => {};
    document.addEventListener("touchstart", press, { passive: true });
    let stored = false;
    try {
      stored = localStorage.getItem("lp-motion-paused") === "1";
    } catch {
      stored = false;
    }
    if (stored) {
      setPaused(true);
      html.classList.add("lp-paused");
    }
    const refit = () => root && fitGiants(root);
    refit();
    let suggesting = html.classList.contains("lp-suggesting");
    const classWatch = new MutationObserver(() => {
      const now = html.classList.contains("lp-suggesting");
      if (now === suggesting) return;
      suggesting = now;
      refit();
    });
    classWatch.observe(html, { attributes: true, attributeFilter: ["class"] });
    onCleanup(() => classWatch.disconnect());
    document.fonts?.ready.then(refit);
    let stop: (() => void) | undefined;
    let cancelled = false;
    const failsafe = window.setTimeout(() => {
      if (!html.classList.contains("lp-gsap")) html.classList.remove("lp-motion", "lp-booting");
    }, 4000);
    if (html.classList.contains("lp-motion") && root) {
      import("./scenes")
        .then((m) => m.startScenes(root!, { total: TOTAL, owedShare: SHARES[1].amount / OWED, hasMenu, refit }))
        .then((s) => {
          if (cancelled) s();
          else stop = s;
        })
        .catch(() => html.classList.remove("lp-motion", "lp-booting"));
    } else {
      html.classList.remove("lp-booting");
    }
    onCleanup(() => {
      cancelled = true;
      window.clearTimeout(failsafe);
      stop?.();
      document.removeEventListener("touchstart", press);
      html.classList.remove("landing", "is-android", "lp-paused", "lp-gsap");
      if (prevTheme) theme?.setAttribute("content", prevTheme);
      if (prevScheme) scheme?.setAttribute("content", prevScheme);
    });
  });

  const tickerGroup = () => (
    <div class="lp-tk-group">
      <For each={v2.hero.ticker}>
        {(t) => (
          <span>
            {t}
            <span aria-hidden="true">•</span>
          </span>
        )}
      </For>
    </div>
  );

  return (
    <LandingProvider value={{ copy, locale }}>
      <div class="lp" lang={locale.code} ref={root}>
        <div class="lp-boot" aria-hidden="true">
          <div class="lp-boot-in">
            <MarkPieces class="lp-boot-mark" viewBox="-40 0 480 672" />
            <div class="lp-boot-label">{v2.boot.label}</div>
            <div class="lp-boot-count" data-total={TOTAL} data-locale={numberLocale(locale)}>
              {money.format(0)}
            </div>
            <div class="lp-boot-shares">
              <span class="lp-boot-list">
                <For each={SHARES}>{(s) => <span>{`${s.name}\u00a0${money.format(s.amount)}`}</span>}</For>
              </span>
              {v2.boot.same}
            </div>
          </div>
          <div class="lp-boot-skip">{v2.boot.skip}</div>
        </div>

        <div class="lp-topcap" aria-hidden="true" />
        <LocalNav paused={paused()} onTogglePause={togglePause} />

        <main>
          <section id="top" class="lp-hero">
            <div class="lp-hero-in">
              <div class="lp-wrap lp-hero-head">
                <h1 class="lp-h1">
                  <span class="lp-sr">
                    {copy.hero.titleTop} {plain(copy.hero.titleBottom)}
                  </span>
                  <span class="lp-giant lp-fit" data-cap="15" aria-hidden="true">
                    <For each={v2.hero.giant}>
                      {(line) => (
                        <span class="lp-line">
                          <span class="lp-fl lp-split">{line}</span>
                        </span>
                      )}
                    </For>
                  </span>
                </h1>
                <p class="lp-kicker" aria-hidden="true">
                  <Accent text={copy.hero.titleBottom} />
                </p>
              </div>
              <div class="lp-stage">
                <div class="lp-plate">
                  <MarkPieces />
                </div>
                <div class="lp-rc-wrap">
                  <div class="lp-rc-drop">
                    <div class="lp-receipt" role="img" aria-label={`${DEMO_SNAPSHOT.receipt.merchantName}, ${v2.hero.receipt.total} ${money.format(TOTAL)}`}>
                      <div class="lp-rh">{DEMO_SNAPSHOT.receipt.merchantName!.toUpperCase()}</div>
                      <div class="lp-rs">{v2.hero.receipt.place}</div>
                      <For each={ITEMS}>
                        {(i) => (
                          <div class="lp-row">
                            <span>{i.itemDescription}</span>
                            <span>{receiptNum(i.price)}</span>
                          </div>
                        )}
                      </For>
                      <hr />
                      <div class="lp-row">
                        <span>{v2.hero.receipt.subtotal}</span>
                        <span>{receiptNum(SUBTOTAL)}</span>
                      </div>
                      <div class="lp-row">
                        <span>{v2.hero.receipt.tax}</span>
                        <span>{receiptNum(TAX)}</span>
                      </div>
                      <div class="lp-row">
                        <span>
                          {v2.hero.receipt.tip} ({pct(DEMO_SNAPSHOT.receipt.tipValue)})
                        </span>
                        <span>{receiptNum(TIP)}</span>
                      </div>
                      <div class="lp-row lp-tot">
                        <span>{v2.hero.receipt.total}</span>
                        <span>{receiptNum(TOTAL)}</span>
                      </div>
                      <div class="lp-thanks">{v2.hero.receipt.thanks}</div>
                    </div>
                  </div>
                  <span class="lp-stamp lp-hero-stamp">{copy.how.steps[2].tagline}</span>
                </div>
                <div class="lp-pt" style={{ left: "2%", top: "10%" }} data-depth=".65">
                  <div class="lp-pi" style={{ "--dx": "7px", "--dy": "-9px", "--dur": "6s", "--delay": "-2s" }}>
                    <span class="lp-chip">{pct(7)}</span>
                  </div>
                </div>
                <div class="lp-pt" style={{ right: "2%", top: "8%" }} data-depth="1">
                  <div class="lp-pi" style={{ "--dx": "-8px", "--dy": "10px", "--dur": "8s", "--delay": "-5s", "--dr": "-4deg" }}>
                    <span class="lp-chip lp-chip-ink">{pct(11.5)}</span>
                  </div>
                </div>
                <div class="lp-pt" style={{ left: "2%", bottom: "20%" }} data-depth=".35">
                  <div class="lp-pi" style={{ "--dx": "9px", "--dy": "8px", "--dur": "7s" }}>
                    <span class="lp-chip lp-chip-terra">÷3</span>
                  </div>
                </div>
                <div class="lp-pt" style={{ right: "3%", top: "44%" }} data-depth=".35">
                  <div class="lp-pi" style={{ "--dx": "-6px", "--dy": "9px", "--dur": "9s", "--delay": "-3s" }}>
                    <span class="lp-chip lp-chip-terra">+{pct(DEMO_SNAPSHOT.receipt.tipValue)}</span>
                  </div>
                </div>
                <For each={SHARES}>
                  {(s, i) => (
                    <div
                      class="lp-pt"
                      style={[{ left: "1%", top: "40%" }, { right: "8%", top: "27%" }, { left: "16%", bottom: "-3%" }][i()]}
                      data-depth={[1, 0.65, 0.65][i()]}
                    >
                      <div class="lp-pi" style={[{ "--dx": "6px", "--dy": "-12px", "--dur": "7.5s", "--delay": "-1s" }, { "--dx": "-9px", "--dy": "-7px", "--dur": "6.5s", "--delay": "-4s" }, { "--dx": "8px", "--dy": "-6px", "--dur": "8.5s", "--delay": "-6s" }][i()]}>
                        <img class="lp-face" src={s.avatar} alt="" width={38} height={38} />
                      </div>
                    </div>
                  )}
                </For>
              </div>
              <div class="lp-wrap lp-hero-bottom">
                <div class="lp-hero-cta">
                  <AppStoreBadge />
                  <p class="lp-note">
                    {copy.hero.noteTop}
                    <br />
                    <Phrases text={copy.hero.noteBottom.replace(/iOS (\d)/, "iOS\u00a0$1")} />
                  </p>
                  <QrTile size={72} caption={copy.hero.qrCaption} class="lp-hero-qr" />
                </div>
                <p class="lp-lede">
                  <Phrases text={copy.hero.body} />
                  {/[\u3000-\u303f\uff00-\uffef]$/.test(copy.hero.body) ? "" : " "}
                  <a class="lp-demo-link" href="#try">{v2.hero.demoLink}</a>
                </p>
                <p class="lp-android">{copy.hero.android}</p>
              </div>
              <div class="lp-ticker" aria-hidden="true">
                <div class="lp-tk-track" style={{ "--tk": `${Math.max(14, v2.hero.ticker.join(" ").length * 0.22)}s` }}>
                  {tickerGroup()}
                  {tickerGroup()}
                </div>
              </div>
              <div class="lp-scrim" />
            </div>
          </section>

          <section id="how" class="lp-how" aria-labelledby="how-h">
            <h2 class="lp-sr" id="how-h">
              {plain(copy.how.title)}
            </h2>
            <ol class="lp-sr">
              <For each={copy.how.steps}>
                {(s) => (
                  <li>
                    <h3>{plain(s.title)}</h3>
                    <p>{s.body}</p>
                  </li>
                )}
              </For>
            </ol>
            <div class="lp-how-stage">
              <div class="lp-how-bar">
                <span class="lp-bar-label">{chapter("how")}</span>
                <div class="lp-segs">
                  <For each={copy.how.steps}>
                    {(s, i) => (
                      <button type="button" aria-label={copy.how.stepGo(i() + 1, s.rail)}>
                        <i>
                          <b />
                        </i>
                      </button>
                    )}
                  </For>
                </div>
              </div>

              <div class="lp-step" style={{ "--c": "var(--terracotta-light)", "--t": "var(--ink)", "--v": "var(--ink)", "z-index": 1 }} aria-hidden="true">
                <div class="lp-flood" />
                <div class="lp-verb">
                  <span class="lp-vrow">
                    <span class="lp-giant lp-fitw" data-cap="17">
                      {v2.how.words[0]}
                    </span>
                  </span>
                </div>
                <Phone rest={-5} bubbles={[{ y: 38, x: 50, side: "c", text: v2.how.snapBubble, tilt: -3 }]}>
                  <ShotPicture shot={localizedShot("scan", locale)} sizes="(min-width:1024px) 300px, 45vw" eager />
                </Phone>
                <div class="lp-cap">
                  <h3 class="lp-h3">{plain(copy.how.steps[0].title)}</h3>
                  <p>{v2.how.caps[0]}</p>
                </div>
              </div>

              <div class="lp-step lp-on-dark" style={{ "--c": "var(--ink)", "--t": "var(--linen)", "--v": "var(--terracotta)", "z-index": 2 }} aria-hidden="true">
                <div class="lp-flood" />
                <div class="lp-verb">
                  <span class="lp-vrow">
                    <span class="lp-giant lp-fitw" data-cap="17">
                      {v2.how.words[1]}
                    </span>
                  </span>
                </div>
                <Phone rest={4} bubbles={tapBubbles}>
                  <video class="lp-assign" muted loop playsinline preload="metadata" poster={`/landing/assign-first-v1${assignSuffix}-720.webp`}>
                    <source src={`/landing/assign-v1${assignSuffix}.hevc.mp4`} type='video/mp4; codecs="hvc1"' />
                    <source src={`/landing/assign-v1${assignSuffix}.h264.mp4`} type="video/mp4" />
                  </video>
                </Phone>
                <div class="lp-cap">
                  <h3 class="lp-h3">{plain(copy.how.steps[1].title)}</h3>
                  <p>{v2.how.caps[1]}</p>
                </div>
              </div>

              <div class="lp-step" style={{ "--c": "var(--linen)", "--t": "var(--ink)", "--v": "var(--terracotta)", "z-index": 3 }} aria-hidden="true">
                <div class="lp-flood" />
                <div class="lp-verb">
                  <span class="lp-vrow">
                    <span class="lp-giant lp-fitw" data-cap="17">
                      {v2.how.words[2]}
                    </span>
                  </span>
                </div>
                <Phone rest={-4} bubbles={taxBubbles}>
                  <ShotPicture shot={localizedShot("taxes", locale)} sizes="(min-width:1024px) 300px, 45vw" eager />
                </Phone>
                <div class="lp-cap">
                  <h3 class="lp-h3">{plain(copy.how.steps[2].title)}</h3>
                  <p>{v2.how.caps[2]}</p>
                </div>
              </div>

              <div class="lp-step lp-pay-step" style={{ "--c": "var(--terracotta-light)", "--t": "var(--ink)", "--v": "var(--ink)", "z-index": 4 }} aria-hidden="true">
                <div class="lp-flood" />
                <div class="lp-verb">
                  <span class="lp-vrow">
                    <span class="lp-giant lp-fitw" data-cap="17">
                      {v2.how.words[3]}
                    </span>
                  </span>
                </div>
                <Phone rest={5} bubbles={payBubbles}>
                  <Show when={hasMenu} fallback={<ShotPicture shot={localizedShot("settle", locale)} sizes="(min-width:1024px) 300px, 45vw" eager />}>
                    <ShotPicture shot={settle.closed} sizes="(min-width:1024px) 300px, 45vw" eager />
                    <ShotPicture shot={settle.menu} sizes="(min-width:1024px) 300px, 45vw" eager class="lp-scr2" />
                  </Show>
                </Phone>
                <div class="lp-cap">
                  <h3 class="lp-h3">{plain(copy.how.steps[3].title)}</h3>
                  <p>{v2.how.caps[3]}</p>
                </div>
              </div>
            </div>
          </section>

          <section id="send" class="lp-table" aria-labelledby="send-h">
            <div class="lp-wrap lp-table-head">
              <div>
                <Stamp text={v2.table.stamp} dark />
                <h2 class="lp-h2" id="send-h">
                  <Accent text={copy.send.title} />
                </h2>
              </div>
              <p class="lp-lede">
                <Phrases text={copy.send.body} />
              </p>
            </div>
            <div class="lp-bands">
              <article class="lp-band" style={{ "--i": 0, "--c": "var(--terracotta-light)" }}>
                <div class="lp-band-tab">
                  <img class="lp-face" src={MARISOL.avatarUrl!} alt="" width={34} height={34} />
                  <span class="lp-band-name">{SHARES[0].name}</span>
                  <span class="lp-stamp">{v2.table.bands[0].stamp}</span>
                </div>
                <div class="lp-band-body">
                  <p>
                    <Phrases text={v2.table.bands[0].line} />
                  </p>
                  <div class="lp-linkcard" role="img" aria-label={copy.send.cardAlt}>
                    <div class="lp-lc-sheet">
                      <div class="lp-lc-head">
                        <b>{DEMO_SNAPSHOT.receipt.merchantName}</b>
                        <span class="lp-lc-icon">
                          <MarkPieces />
                        </span>
                      </div>
                      <For each={ITEMS}>
                        {(i) => (
                          <div class="lp-lc-row">
                            <span>
                              {i.itemDescription}
                              <Show when={(FULL_ASSIGN.get(i.id)?.length ?? 1) > 1}>
                                <i>÷{FULL_ASSIGN.get(i.id)!.length}</i>
                              </Show>
                            </span>
                            <span>{money.format(i.price)}</span>
                          </div>
                        )}
                      </For>
                      <div class="lp-lc-sub">
                        <span>{v2.hero.receipt.subtotal}</span>
                        <span>{money.format(SUBTOTAL)}</span>
                        <span>{v2.hero.receipt.tax}</span>
                        <span>{money.format(TAX)}</span>
                        <span>{v2.hero.receipt.tip}</span>
                        <span>{money.format(TIP)}</span>
                      </div>
                      <div class="lp-lc-tot">
                        <span>{v2.hero.receipt.total}</span>
                        <span>{money.format(TOTAL)}</span>
                      </div>
                    </div>
                    <div class="lp-lc-foot">
                      <b>{v2.table.cardTitle}</b>
                      <span>splitea.app</span>
                    </div>
                  </div>
                </div>
              </article>
              <article class="lp-band" style={{ "--i": 1, "--c": "var(--linen)" }}>
                <div class="lp-band-tab">
                  <img class="lp-face" src={ANDRES.avatarUrl!} alt="" width={34} height={34} />
                  <span class="lp-band-name">{SHARES[1].name}</span>
                  <span class="lp-stamp lp-stamp-terra">{v2.table.bands[1].stamp}</span>
                </div>
                <div class="lp-band-body">
                  <p>
                    <Phrases text={v2.table.bands[1].line} />
                  </p>
                  <span class="lp-live">
                    <i />
                    {copy.send.connected}
                  </span>
                  <div class="lp-mini">
                    <For each={andresItems}>
                      {(it) => (
                        <div class="lp-mini-row">
                          <Show when={it.splitCount > 1} fallback={<img class="lp-face" src={ANDRES.avatarUrl!} alt="" width={30} height={30} />}>
                            <span class="lp-chip lp-chip-terra">÷{it.splitCount}</span>
                          </Show>
                          <span class="lp-mini-name">{it.description}</span>
                          <span class="lp-mini-amt">{money.format(it.amount)}</span>
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              </article>
              <article class="lp-band" style={{ "--i": 2, "--c": "var(--terracotta-light)" }}>
                <div class="lp-band-tab">
                  <img class="lp-face" src={NINA.avatarUrl!} alt="" width={34} height={34} />
                  <span class="lp-band-name">{SHARES[2].name}</span>
                  <span class="lp-stamp">{v2.table.bands[2].stamp}</span>
                </div>
                <div class="lp-band-body lp-nina">
                  <p>
                    <Phrases text={v2.table.bands[2].line} />
                  </p>
                  <div class="lp-paybtn" aria-hidden="true">
                    {v2.table.payButton(SHARES[0].name, money.format(SHARES[2].amount))}
                  </div>
                  <p class="lp-small">{v2.table.payNote}</p>
                  <div class="lp-pp" role="img" aria-label={v2.table.paypal.alt(MARISOL.fullName!, money.format(SHARES[2].amount))}>
                    <img class="lp-pp-icon" src="/landing/paypal-icon-v1.png" alt="" width={46} height={46} decoding="async" />
                    <div class="lp-pp-screen" aria-hidden="true">
                      <div class="lp-pp-top">
                        <span class="lp-pp-back">
                          <svg viewBox="0 0 6 8">
                            <path d="M6 0v8L0 4z" fill="currentColor" />
                          </svg>
                          Splitea
                        </span>
                        <span class="lp-pp-x">
                          <svg viewBox="0 0 12 12">
                            <path d="m1.5 1.5 9 9m0-9-9 9" fill="none" stroke="currentColor" stroke-width="0.9" />
                          </svg>
                        </span>
                      </div>
                      <div class="lp-pp-who">
                        <span class="lp-pp-ini">
                          {MARISOL.fullName!
                            .split(" ")
                            .map((w) => w[0])
                            .join("")}
                        </span>
                        <b>{MARISOL.fullName}</b>
                      </div>
                      <div class="lp-pp-amt">
                        <For each={money.formatToParts(SHARES[2].amount)}>
                          {(part) => (part.type === "currency" ? <span class="lp-pp-sym">{part.value}</span> : <>{part.value}</>)}
                        </For>
                      </div>
                      <span class="lp-pp-cur">
                        <i />
                        USD
                        <svg viewBox="0 0 10 6">
                          <path d="m1 1 4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
                        </svg>
                      </span>
                      <div class="lp-pp-btns">
                        <span>{v2.table.paypal.request}</span>
                        <span>{v2.table.paypal.send}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
              <article class="lp-band" style={{ "--i": 3, "--c": "var(--linen)" }}>
                <div class="lp-band-tab">
                  <span class="lp-stile">
                    <MarkPieces />
                  </span>
                  <span class="lp-band-name">Splitea</span>
                  <span class="lp-stamp lp-stamp-terra">{v2.table.bands[3].stamp}</span>
                </div>
                <div class="lp-band-body">
                  <p>
                    <Phrases text={v2.table.bands[3].line} />
                  </p>
                  <div class="lp-totals">
                    <div class="lp-row">
                      <span>{v2.hero.receipt.subtotal}</span>
                      <span>{money.format(SUBTOTAL)}</span>
                    </div>
                    <div class="lp-row">
                      <span>
                        {v2.hero.receipt.tax} <span class="lp-ok">✓</span>
                      </span>
                      <span>{money.format(TAX)}</span>
                    </div>
                    <div class="lp-row">
                      <span>
                        {v2.hero.receipt.tip} ({pct(DEMO_SNAPSHOT.receipt.tipValue)})
                      </span>
                      <span>{money.format(TIP)}</span>
                    </div>
                    <div class="lp-row lp-tot">
                      <span>{v2.hero.receipt.total}</span>
                      <span>{money.format(TOTAL)}</span>
                    </div>
                  </div>
                  <div class="lp-shares">
                    <For each={SHARES}>
                      {(s) => (
                        <span class="lp-chip lp-share">
                          <small>{s.name}</small>
                          <b>{money.format(s.amount)}</b>
                        </span>
                      )}
                    </For>
                  </div>
                </div>
              </article>
            </div>
          </section>

          <section id="try" class="lp-try" aria-labelledby="try-h">
            <div class="lp-wrap lp-try-grid">
              <div>
                <Stamp text={v2.try.stamp} />
                <h2 class="lp-h2" id="try-h">
                  {v2.try.title}
                </h2>
                <p class="lp-lede">
                  <Phrases text={v2.try.body} />
                </p>
                <div class="lp-numpills">
                  <span class="lp-numpill">
                    <b>1</b>
                    {copy.hero.pills[0]}
                  </span>
                  <span class="lp-numpill">
                    <b>2</b>
                    {copy.hero.pills[1]}
                  </span>
                </div>
              </div>
              <div class="lp-try-device">
                <DemoGate>
                  <DeviceFrame>
                    <div lang={locale.code} style={{ display: "contents" }}>
                      <Show when={!isServer}>
                        <ItemsViewDemo snapshot={snapshot} />
                      </Show>
                    </div>
                  </DeviceFrame>
                </DemoGate>
                <p class="lp-device-label">{copy.hero.demoLabel}</p>
              </div>
            </div>
          </section>

          <section id="trips" class="lp-chapter lp-trips" aria-labelledby="trips-h">
            <span class="lp-giant lp-bigword lp-fitw" data-cap="26" aria-hidden="true">
              <span>{v2.trips.word}</span>
            </span>
            <div class="lp-wrap lp-chapter-grid">
              <div>
                <Stamp text={chapter("trips")} dark />
                <h2 class="lp-h2" id="trips-h">
                  <Accent text={copy.trips.title} />
                </h2>
                <p class="lp-lede">{copy.trips.body}</p>
              </div>
              <div class="lp-visual">
                <Phone rest={5} class="lp-tphone" label={copy.trips.alt}>
                  <ShotPicture shot={localizedShot("trip-dc", locale)} sizes="(min-width:1024px) 320px, 52vw" />
                </Phone>
                <span class="lp-bub lp-trips-tag" aria-hidden="true">
                  <span class="lp-stamp" style={{ rotate: "-6deg" }}>
                    {v2.trips.bubble}
                  </span>
                </span>
                <Seal text={copy.trips.tagline} class="lp-chapter-seal" />
              </div>
            </div>
          </section>

          <section id="digital" class="lp-chapter lp-digital" aria-labelledby="digital-h">
            <span class="lp-giant lp-bigword lp-fitw" data-cap="26" aria-hidden="true">
              <span>{v2.digital.word}</span>
            </span>
            <div class="lp-wrap lp-chapter-grid">
              <div>
                <Stamp text={v2.digital.stamp} dark />
                <h2 class="lp-h2" id="digital-h">
                  <Accent text={copy.digital.title} />
                </h2>
                <p class="lp-lede">{copy.digital.body}</p>
              </div>
              <div class="lp-visual lp-sheet-visual">
                <div class="lp-sheet">
                  <div class="lp-ss" role="img" aria-label={copy.digital.alt}>
                    <div class="lp-ss-head">
                      <img class="lp-ss-site" src="/landing/share-clover-v1.webp" alt="" width={56} height={56} decoding="async" />
                      <div class="lp-ss-meta">
                        <b>Julieta Restaurant</b>
                        <span>clover.com</span>
                        <span class="lp-ss-opt">
                          {v2.digital.sheet.options}
                          <svg viewBox="0 0 6 10" aria-hidden="true">
                            <path d="m1 1 4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                          </svg>
                        </span>
                      </div>
                    </div>
                    <div class="lp-ss-apps">
                      <For each={[["news", v2.digital.sheet.news], ["reminders", v2.digital.sheet.reminders], ["splitea", "Splitea"], ["more", v2.digital.sheet.more]] as const}>
                        {([k, label]) => (
                          <span class="lp-ss-app">
                            <img src={`/landing/share-${k}-v1.webp`} alt="" width={64} height={64} decoding="async" />
                            <small>{label}</small>
                            <Show when={k === "splitea"}>
                              <span class="lp-sheet-pb lp-ss-pb">
                                <span class="lp-stamp lp-stamp-terra" style={{ rotate: "-1deg" }}>
                                  <b>2</b> {copy.digital.pills[1]}
                                </span>
                              </span>
                            </Show>
                          </span>
                        )}
                      </For>
                    </div>
                  </div>
                  <span class="lp-sheet-first">
                    <span class="lp-stamp lp-stamp-terra" style={{ rotate: "-3deg" }}>
                      <b>1</b> {copy.digital.pills[0]}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </section>

          <section id="abroad" class="lp-chapter lp-abroad" aria-labelledby="abroad-h">
            <div class="lp-tapes" aria-hidden="true">
              <div class="lp-tape lp-tape-a">
                <div class="lp-tk-track lp-tape-track">
                  <For each={[0, 1]}>
                    {() => (
                      <div class="lp-tk-group">
                        <For each={[0, 1, 2]}>
                          {() => (
                            <span>
                              {plain(copy.abroad.title)}
                              <span>•</span>
                            </span>
                          )}
                        </For>
                      </div>
                    )}
                  </For>
                </div>
              </div>
              <div class="lp-tape lp-tape-b">
                <div class="lp-tk-track lp-tape-track">
                  <For each={[0, 1]}>
                    {() => (
                      <div class="lp-tk-group">
                        <For each={["USD", "EUR", "MXN", "JPY", "KRW", "GBP", "BRL", "INR"]}>
                          {(c) => (
                            <span>
                              {c}
                              <span>•</span>
                            </span>
                          )}
                        </For>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            </div>
            <div class="lp-giant lp-symbols lp-fitw" data-cap="22" aria-hidden="true">
              <span>$ € ¥ ₩ £</span>
            </div>
            <div class="lp-wrap lp-chapter-grid">
              <div>
                <Stamp text={chapter("abroad")} dark />
                <h2 class="lp-h2" id="abroad-h">
                  <Accent text={copy.abroad.title} />
                </h2>
                <p class="lp-lede">{copy.abroad.body}</p>
                <p class="lp-lede">
                  {copy.abroad.translateBefore}
                  <span class="lp-nowrap">
                    <span class="lp-cjk" lang={copy.abroad.translateExampleLang}>
                      {copy.abroad.translateExample}
                    </span>
                    {translateGloss}
                  </span>
                  {translateRest}
                </p>
              </div>
              <div class="lp-visual">
                <Phone rest={-6} class="lp-fxphone" label={copy.abroad.alt} bubbles={[{ y: FX_ROW_Y[locale.code] ?? 57.4, x: 43, side: "l", text: v2.abroad.bubble, tilt: 0 }]}>
                  <ShotPicture shot={localizedShot("fx", locale)} sizes="(min-width:1024px) 320px, 52vw" />
                </Phone>
                <Seal text={copy.abroad.tagline} class="lp-chapter-seal lp-abroad-seal" />
              </div>
            </div>
            <div class="lp-wrap lp-regions">
              <h3 class="lp-h3">
                <Phrases text={copy.abroad.payTitle} />
              </h3>
              <ul class="lp-region-rail">
                <For each={copy.abroad.regions}>
                  {(r) => (
                    <li class="lp-region">
                      <p class="lp-region-title">{r.title}</p>
                      <p class="lp-region-text">{r.text}</p>
                    </li>
                  )}
                </For>
              </ul>
              <p class="lp-note lp-region-foot">{copy.abroad.footnote}</p>
            </div>
          </section>

          <section id="privacy" class="lp-privacy" aria-labelledby="privacy-h">
            <div class="lp-wrap">
              <Stamp text={chapter("privacy")} dark />
              <h2 class="lp-h2" id="privacy-h">
                <Accent text={copy.privacy.title} />
              </h2>
              <p class="lp-lede">{copy.privacy.body}</p>
              <div class="lp-facts">
                <For each={copy.privacy.facts}>
                  {(f) => (
                    <div class="lp-fact">
                      <p class="lp-fact-title">{f.title}</p>
                      <p class="lp-fact-text">{f.text}</p>
                    </div>
                  )}
                </For>
              </div>
              <a class="lp-policy" rel="external" href="/legal/privacy">
                {copy.privacy.link}
              </a>
            </div>
          </section>

          <section id="pricing" class="lp-check" aria-labelledby="pricing-h">
            <div class="lp-wrap lp-check-grid">
              <div>
                <Stamp text={v2.check.stamp} dark />
                <h2 class="lp-h2" id="pricing-h">
                  {v2.check.title}
                </h2>
                <p class="lp-lede">{copy.pricing.body}</p>
                <p class="lp-note">{copy.pricing.fine}</p>
                <AppStoreBadge class="lp-check-badge" />
              </div>
              <div class="lp-long-wrap">
                <div class="lp-rc-shadow">
                  <div class="lp-receipt lp-long">
                    <div class="lp-rh">SPLITEA</div>
                    <div class="lp-rs">{v2.check.stamp}</div>
                    <div class="lp-row">
                      <span>{v2.check.download}</span>
                      <i class="lp-lead" />
                      <span>{v2.check.free}</span>
                    </div>
                    <div class="lp-row">
                      <span>{v2.check.scans}</span>
                      <i class="lp-lead" />
                      <span>3</span>
                    </div>
                    <div class="lp-sub">{v2.check.scansNote}</div>
                    <div class="lp-row">
                      <span>{v2.check.monthly.replace("Splitea Unlimited", "Splitea\u00a0Unlimited")}</span>
                      <i class="lp-lead" />
                      <span>{money.format(PRICES_US.monthly)}</span>
                    </div>
                    <div class="lp-row">
                      <span>{v2.check.yearly.replace("Splitea Unlimited", "Splitea\u00a0Unlimited")}</span>
                      <i class="lp-lead" />
                      <span>{money.format(PRICES_US.yearly)}</span>
                    </div>
                    <div class="lp-sub">{v2.check.unlimitedNote}</div>
                    <div class="lp-row">
                      <span>{v2.check.friends}</span>
                      <i class="lp-lead" />
                      <span>{v2.check.free}</span>
                    </div>
                    <div class="lp-row lp-row-multi">
                      <span>
                        <Phrases text={v2.check.included} />
                      </span>
                    </div>
                    <div class="lp-row">
                      <i class="lp-lead" />
                      <span>{v2.check.free}</span>
                    </div>
                    <hr />
                    <div class="lp-row">
                      <span>{v2.check.money}</span>
                      <i class="lp-lead" />
                      <span>{money.format(0)}</span>
                    </div>
                    <div class="lp-row">
                      <span>{v2.check.ads}</span>
                      <i class="lp-lead" />
                      <span>0</span>
                    </div>
                    <hr />
                    <div class="lp-row lp-due">
                      <span>{v2.check.due}</span>
                      <span>{money.format(0)}</span>
                    </div>
                    <div class="lp-thanks">
                      <Accent text={v2.check.usNote} />
                    </div>
                  </div>
                </div>
                <span class="lp-stamp lp-check-stamp">{v2.hero.badge}</span>
                <Seal text={copy.pricing.tagline} class="lp-check-seal" />
              </div>
            </div>
          </section>

          <section id="faq" class="lp-faq" aria-labelledby="faq-h">
            <div class="lp-wrap">
              <h2 class="lp-h2" id="faq-h">
                <Accent text={copy.faq.title} />
              </h2>
              <div class="lp-faq-list">
                <For each={copy.faq.items}>
                  {(item) => (
                    <details>
                      <summary onClick={foldDetails}>
                        <Phrases text={item.q} />
                      </summary>
                      <p>
                        <MailLinks text={item.a} />
                      </p>
                    </details>
                  )}
                </For>
                <details>
                  <summary onClick={foldDetails}>{copy.faq.dataQ}</summary>
                  <p>
                    {copy.faq.dataBefore}
                    <a href="#privacy">{copy.faq.dataLink}</a>
                    {copy.faq.dataAfter}
                  </p>
                </details>
              </div>
            </div>
          </section>

          <section id="last" class="lp-last" aria-labelledby="last-h">
            <div class="lp-last-stage">
              <div class="lp-last-head">
                <Stamp text={v2.last.stamp} dark />
                <h2 class="lp-h2" id="last-h">
                  <Phrases text={v2.last.title} />
                </h2>
                <p class="lp-lede">{v2.last.body}</p>
              </div>
              <div class="lp-ring" aria-hidden="true">
                <div class="lp-ring-flip">
                  <div class="lp-face2 lp-face2-front">
                    <svg class="lp-ring-svg" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="44" fill="none" stroke="rgb(26 22 20 / .1)" stroke-width="8" />
                      <circle class="lp-ring-arc" cx="50" cy="50" r="44" fill="none" stroke-width="8" stroke-linecap="round" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100" />
                    </svg>
                    <div class="lp-ring-txt">
                      <div class="lp-ring-k">{v2.last.owed}</div>
                      <div class="lp-ring-v">{money.format(OWED)}</div>
                      <div class="lp-ring-s" data-state="2">
                        <span>{v2.last.settled(0, 2)}</span>
                        <span>{v2.last.settled(1, 2)}</span>
                        <span>{v2.last.allSettled}</span>
                      </div>
                    </div>
                  </div>
                  <div class="lp-face2 lp-face2-back">
                    <MarkPieces />
                  </div>
                </div>
              </div>
              <For each={[1, 2]}>
                {(n) => {
                  const person = n === 1 ? SHARES[1] : SHARES[2];
                  const text = v2.last.toast(person.name, DEMO_SNAPSHOT.receipt.merchantName!.replace(/ /g, "\u00a0"));
                  return (
                    <div class={`lp-pcard lp-pcard-${n}`} role="note" aria-label={text}>
                      <span class="lp-giant lp-pcard-name" aria-hidden="true">
                        {person.name}
                      </span>
                      <div class="lp-toast">
                        <span class="lp-toast-ck">
                          <svg viewBox="0 0 14 14" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <path d="M3 7.4l2.6 2.5L11 4.4" />
                          </svg>
                        </span>
                        {text}
                      </div>
                      <span class={`lp-stamp ${n === 2 ? "lp-stamp-terra" : ""}`}>{v2.last.paid}</span>
                    </div>
                  );
                }}
              </For>
              <div class="lp-flood2" />
            </div>
          </section>

          <section id="get" class="lp-get" aria-labelledby="get-h">
            <div class="lp-wrap">
              <span class="lp-giant lp-paid lp-fitw" data-cap="34" aria-hidden="true">
                <span class="lp-line">
                  <span class="lp-split">{v2.get.word}</span>
                </span>
              </span>
              <div class="lp-get-row">
                <MarkPieces class="lp-get-mark" viewBox="-40 0 480 672" />
                <div>
                  <h2 class="lp-h2" id="get-h">
                    <Accent text={copy.get.title} />
                  </h2>
                  <p class="lp-lede">{copy.get.body}</p>
                </div>
                <div class="lp-get-cta">
                  <AppStoreBadge height={56} />
                  <QrTile size={120} caption={copy.get.qrCaption} class="lp-get-qr" />
                </div>
                <p class="lp-note">{copy.get.small.replace(/iOS (\d)/, "iOS\u00a0$1")}</p>
                <p class="lp-pron">
                  <Show when={copy.get.pronunciation}>
                    <span class="lp-pron-say">{copy.get.pronunciation}</span>
                  </Show>
                  <span class="lp-pron-tag">{copy.get.tagline}</span>
                </p>
              </div>
            </div>
          </section>
        </main>

        <div class="lp-foot-bed">
          <footer class="lp-footer">
            <div class="lp-footer-brand">
              <MarkPieces class="lp-footer-mark" />
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
              <PauseButton paused={paused()} onToggle={togglePause} variant="text" />
            </div>
            <nav class="lp-langs" aria-label={copy.footer.languages}>
              <ul>
                <For each={LANDING_LOCALES}>
                  {(l) => (
                    <li>
                      <a href={pathFor(l)} rel="external" lang={l.code} hreflang={l.hreflang} aria-current={l.code === locale.code ? "page" : undefined}>
                        {l.name}
                      </a>
                    </li>
                  )}
                </For>
              </ul>
            </nav>
            <div class="lp-footer-legal">
              <For each={copy.footer.legal}>{(l) => <p>{l}</p>}</For>
            </div>
          </footer>
        </div>
        <LangSuggest current={locale} dismiss={copy.nav.dismiss} />
      </div>
    </LandingProvider>
  );
}
