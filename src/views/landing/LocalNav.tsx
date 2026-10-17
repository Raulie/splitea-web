import { For, Show, createSignal, onCleanup, onMount } from "solid-js";
import { appStoreUrl } from "./appStore";
import { useLanding } from "./locales";
import { createMediaQuery } from "./motion";
import { MarkPieces, QrCode } from "./parts";

export function PauseButton(props: { paused: boolean; onToggle: () => void; variant: "icon" | "text" }) {
  const { copy } = useLanding();
  const label = () => (props.paused ? copy.v2.motion.play : copy.v2.motion.pause);
  return (
    <Show
      when={props.variant === "icon"}
      fallback={
        <button type="button" class="lp-pause-text" aria-pressed={props.paused} onClick={() => props.onToggle()}>
          {label()}
        </button>
      }
    >
      <button type="button" class="lp-iconbtn" aria-pressed={props.paused} aria-label={label()} onClick={() => props.onToggle()}>
        <Show
          when={props.paused}
          fallback={
            <svg viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
              <rect x="2" y="1" width="3.5" height="12" rx="1" />
              <rect x="8.5" y="1" width="3.5" height="12" rx="1" />
            </svg>
          }
        >
          <svg viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
            <path d="M3 1.5v11l9.5-5.5z" />
          </svg>
        </Show>
      </button>
    </Show>
  );
}

export function LocalNav(props: { paused: boolean; onTogglePause: () => void }) {
  const { copy } = useLanding();
  const [current, setCurrent] = createSignal<string | null>(null);
  const [inHero, setInHero] = createSignal(true);
  let nav!: HTMLDivElement;
  const desktopPointer = createMediaQuery("(hover: hover) and (pointer: fine) and (min-width: 1024px)");

  onMount(() => {
    const chapterIO = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) if (entry.isIntersecting) setCurrent(entry.target.id);
      },
      { rootMargin: "-45% 0px -54% 0px" },
    );
    document.querySelectorAll(".lp main > section[id]").forEach((el) => chapterIO.observe(el));
    onCleanup(() => chapterIO.disconnect());

    const next = document.getElementById("top")?.nextElementSibling;
    const check = () => setInHero(!!next && next.getBoundingClientRect().top > nav.offsetTop + nav.offsetHeight);
    check();
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    onCleanup(() => {
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    });
  });

  return (
    <div class="lp-nav" classList={{ "is-hidden": inHero() }} ref={nav}>
      <nav class="lp-nav-pill" aria-label="Splitea">
        <a class="lp-nav-brand" href="#top">
          <MarkPieces class="lp-nav-mark" />
          <span>Splitea</span>
        </a>
        <ul class="lp-nav-links">
          <For each={copy.nav.chapters}>
            {(c) => (
              <li>
                <a href={`#${c.id}`} aria-current={current() === c.id ? "true" : undefined}>
                  {c.label}
                </a>
              </li>
            )}
          </For>
        </ul>
        <span class="lp-nav-spacer" />
        <PauseButton paused={props.paused} onToggle={props.onTogglePause} variant="icon" />
        <Show
          when={desktopPointer()}
          fallback={
            <a class="lp-nav-cta" href={appStoreUrl("landing")}>
              {copy.nav.cta}
            </a>
          }
        >
          <button class="lp-nav-cta" type="button" popovertarget="lp-get-qr">
            {copy.nav.cta}
          </button>
        </Show>
      </nav>
      <Show when={desktopPointer()}>
        <div id="lp-get-qr" class="lp-popover" popover="auto">
          <QrCode size={160} class="lp-popover-qr" />
          <p>{copy.nav.qrLine}</p>
          <a href={appStoreUrl("landing")}>{copy.nav.qrLink}</a>
        </div>
      </Show>
    </div>
  );
}
