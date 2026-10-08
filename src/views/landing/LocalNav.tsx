import { For, Show, createSignal, onCleanup, onMount } from "solid-js";
import { SpliteaMark } from "../../components/SpliteaMark";
import { appStoreUrl } from "./appStore";
import { copy } from "./copy";
import { createMediaQuery } from "./motion";
import { QrCode } from "./parts";

export function LocalNav(props: { watch: () => Element | undefined }) {
  const [shown, setShown] = createSignal(false);
  const [current, setCurrent] = createSignal<string | null>(null);
  const desktopPointer = createMediaQuery("(hover: hover) and (pointer: fine) and (min-width: 1024px)");

  onMount(() => {
    const target = props.watch();
    const badgeIO = new IntersectionObserver(
      ([entry]) => setShown(!entry.isIntersecting && entry.boundingClientRect.bottom < 60),
      { rootMargin: "-60px 0px 0px 0px" },
    );
    if (target) badgeIO.observe(target);

    const chapterIO = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) if (entry.isIntersecting) setCurrent(entry.target.id);
      },
      { rootMargin: "-45% 0px -54% 0px" },
    );
    document.querySelectorAll(".lp > section[id]").forEach((el) => chapterIO.observe(el));

    onCleanup(() => {
      badgeIO.disconnect();
      chapterIO.disconnect();
    });
  });

  return (
    <div class="lp-nav">
      <nav class="lp-nav-pill" classList={{ "is-shown": shown() }} inert={!shown()} aria-label="Splitea">
        <a class="lp-nav-brand" href="#top">
          <SpliteaMark class="lp-nav-mark" />
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
