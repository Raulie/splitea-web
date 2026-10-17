import { For, Show, createUniqueId, type JSX } from "solid-js";
import { BEZEL_SRC, appStoreUrl } from "./appStore";
import { badgeSrc, useLanding } from "./locales";
import { QR_PATH, QR_SIZE } from "./qr";

export function Accent(props: { text: string }) {
  const parts = () => props.text.split(/(\[\[[^\]]+\]\]|\n)/).filter(Boolean);
  return (
    <For each={parts()}>
      {(part) =>
        part === "\n" ? <br /> : part.startsWith("[[") ? <em>{part.slice(2, -2)}</em> : <>{part}</>
      }
    </For>
  );
}

export function Phrases(props: { text: string }) {
  const parts = () => props.text.split("\u200b");
  return (
    <Show when={parts().length > 1} fallback={props.text}>
      <span>
        <For each={parts()}>{(p) => <span class="lp-ph">{p}</span>}</For>
      </span>
    </Show>
  );
}

export function MailLinks(props: { text: string }) {
  const parts = () => props.text.split(/([\w.+-]+@[\w-]+(?:\.[\w-]+)+)/);
  return <For each={parts()}>{(part, i) => (i() % 2 ? <a href={`mailto:${part}`}>{part}</a> : <>{part}</>)}</For>;
}

export function foldDetails(e: MouseEvent) {
  const details = (e.currentTarget as HTMLElement).parentElement as HTMLDetailsElement;
  const answer = details.lastElementChild as HTMLElement;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  e.preventDefault();
  const from = details.getBoundingClientRect().height;
  details.getAnimations().forEach((a) => a.cancel());
  answer.getAnimations().forEach((a) => a.cancel());
  const opening = !details.open || details.classList.contains("is-closing");
  details.classList.toggle("is-closing", !opening);
  details.open = true;
  const to = opening ? details.offsetHeight : (details.firstElementChild as HTMLElement).offsetHeight;
  details.style.overflow = "hidden";
  const fold = details.animate([{ height: `${from}px` }, { height: `${to}px` }], {
    duration: opening ? 340 : 220,
    easing: opening ? "cubic-bezier(0.2, 1.25, 0.35, 1)" : "cubic-bezier(0.4, 0, 0.2, 1)",
    fill: "forwards",
  });
  answer.animate(
    opening
      ? [{ opacity: 0, transform: "translateY(-6px)" }, { opacity: 1, transform: "none" }]
      : [{ opacity: 1 }, { opacity: 0 }],
    { duration: opening ? 260 : 140, delay: opening ? 40 : 0, easing: "ease-out", fill: opening ? "backwards" : "forwards" },
  );
  fold.onfinish = () => {
    if (!opening) details.open = false;
    details.classList.remove("is-closing");
    details.style.overflow = "";
    fold.cancel();
    answer.getAnimations().forEach((a) => a.cancel());
  };
}

export const plain = (text: string) =>
  text
    .replace(/\[\[|\]\]/g, "")
    .replace(/([\u3000-\u303f\uff00-\uffef])\n/g, "$1")
    .replace(/\n/g, " ");

export type Shot = { slug: string; widths?: number[]; webp?: number };

export function ShotPicture(props: {
  shot: Shot;
  sizes: string;
  alt?: string;
  width?: number;
  height?: number;
  class?: string;
  eager?: boolean;
}) {
  const widths = () => props.shot.widths ?? [480, 720, 960];
  const webp = () => props.shot.webp ?? 720;
  return (
    <picture class={props.class}>
      <source
        type="image/avif"
        srcset={widths().map((w) => `/landing/${props.shot.slug}-v1-${w}.avif ${w}w`).join(", ")}
        sizes={props.sizes}
      />
      <img
        src={`/landing/${props.shot.slug}-v1-${webp()}.webp`}
        alt={props.alt ?? ""}
        width={props.width ?? 1206}
        height={props.height ?? 2622}
        loading={props.eager ? "eager" : "lazy"}
        decoding="async"
      />
    </picture>
  );
}

export function AppStoreBadge(props: { height?: number; class?: string }) {
  const { copy, locale } = useLanding();
  const h = () => props.height ?? 48;
  return (
    <a class={`lp-badge ${props.class ?? ""}`} href={appStoreUrl("landing")} aria-label={copy.badgeLabel}>
      <img src={badgeSrc(locale)} alt="" width={Math.round((h() * locale.badgeWidth) / 40)} height={h()} style={{ height: `${h()}px` }} />
    </a>
  );
}

export function QrCode(props: { size: number; class?: string }) {
  return (
    <svg
      class={props.class}
      viewBox={`0 0 ${QR_SIZE} ${QR_SIZE}`}
      width={props.size}
      height={props.size}
      shape-rendering="crispEdges"
      aria-hidden="true"
    >
      <rect width={QR_SIZE} height={QR_SIZE} fill="#fff" />
      <path d={QR_PATH} fill="#000" />
    </svg>
  );
}

export function QrTile(props: { size: number; caption: string; class?: string }) {
  return (
    <div class={`lp-qr ${props.class ?? ""}`}>
      <div class="lp-qr-code">
        <QrCode size={props.size} />
      </div>
      <p class="lp-qr-caption">{props.caption}</p>
    </div>
  );
}

export const MARK_PATHS = {
  half: "M283.862 238.563C394.874 302.746 432.953 444.821 368.915 555.895C304.877 666.969 162.97 704.982 51.9581 640.799C51.7784 640.695 51.5994 640.59 51.4201 640.486L283.322 238.253C283.502 238.356 283.682 238.459 283.862 238.563Z",
  b1: "M305.526 11.984C320.035 16.8555 334.276 23.2417 348.041 31.2006C348.221 31.3045 348.4 31.4094 348.58 31.5137L116.678 433.747C116.498 433.644 116.318 433.541 116.138 433.437C102.372 425.478 89.7289 416.32 78.2617 406.174L305.526 11.984Z",
  b2: "M204.565 1.64437C222.213 -0.466666 240.159 -0.561847 258.041 1.4558L45.4142 370.256C34.7286 355.757 25.8379 340.146 18.8394 323.785L204.565 1.64437Z",
  b3: "M31.0849 116.105C57.2791 70.6708 96.5016 37.4614 141.309 18.4699L1.76218 260.514C-4.21754 212.159 4.8907 161.538 31.0849 116.105Z",
} as const;

export const MARK_CLOSE: Record<keyof typeof MARK_PATHS, [number, number]> = {
  half: [32.2, -103.6],
  b1: [-32.2, 103.6],
  b2: [-32.2, 103.6],
  b3: [-32.2, 103.6],
};

export function MarkPieces(props: { closed?: boolean; viewBox?: string; class?: string; id?: string }) {
  const keys = Object.keys(MARK_PATHS) as (keyof typeof MARK_PATHS)[];
  return (
    <svg id={props.id} class={props.class} viewBox={props.viewBox ?? "0 0 400 672"} fill="currentColor" aria-hidden="true">
      <For each={keys}>
        {(k) => (
          <path
            class={`lp-pc ${k === "half" ? "lp-pc-half" : "lp-pc-band"}`}
            data-k={k}
            d={MARK_PATHS[k]}
            transform={props.closed ? `translate(${MARK_CLOSE[k][0]} ${MARK_CLOSE[k][1]})` : undefined}
          />
        )}
      </For>
    </svg>
  );
}

export function Seal(props: { text: string; class?: string; style?: JSX.CSSProperties }) {
  const id = createUniqueId();
  const units = (s: string) => [...s].reduce((a, c) => a + (c > "\u2e7f" ? 1.7 : 1), 0);
  const ring = () => {
    const unit = `${props.text.toUpperCase().replace(/\s*·\s*/g, "\u00a0•\u00a0")}\u00a0•\u00a0`;
    const text = unit.repeat(Math.max(1, Math.floor(37 / units(unit))));
    return { text, size: Math.min(9.6, 232 / (units(text) * 0.64)) };
  };
  return (
    <div class={`lp-seal ${props.class ?? ""}`} style={props.style} aria-hidden="true">
      <svg class="lp-seal-ring" viewBox="0 0 100 100">
        <defs>
          <path id={`lp-seal-${id}`} d="M50,50 m-37,0 a37,37 0 1,1 74,0 a37,37 0 1,1 -74,0" />
        </defs>
        <circle cx="50" cy="50" r="48" class="lp-seal-disc" />
        <text class="lp-seal-text" style={{ "font-size": `${ring().size}px` }}>
          <textPath href={`#lp-seal-${id}`} {...({ textLength: "232", lengthAdjust: "spacing" } as Record<string, string>)}>
            {ring().text}
          </textPath>
        </text>
      </svg>
      <div class="lp-seal-hub">
        <MarkPieces />
      </div>
    </div>
  );
}

export type BubbleAnchor = { y: number; x: number; side: "l" | "r" | "c"; n?: number; text: string; tone?: "terra"; later?: boolean; tilt?: number };

export function Bubble(props: { b: BubbleAnchor; class?: string }) {
  return (
    <span
      class={`lp-bub lp-bub-${props.b.side} ${props.b.later ? "lp-later" : ""} ${props.class ?? ""}`}
      style={{ "--y": props.b.y, "--x": props.b.x }}
    >
      <span class={`lp-stamp ${props.b.tone === "terra" ? "lp-stamp-terra" : ""}`} style={{ rotate: `${props.b.tilt ?? -2}deg` }}>
        <Show when={props.b.n !== undefined}>
          <b>{props.b.n}</b>{" "}
        </Show>
        {props.b.text}
      </span>
    </span>
  );
}

export function Phone(props: { rest?: number; class?: string; label?: string; children: JSX.Element; bubbles?: BubbleAnchor[]; id?: string }) {
  return (
    <figure
      id={props.id}
      class={`lp-phone ${props.class ?? ""}`}
      data-rest={props.rest ?? 0}
      style={{ "--rest": `${props.rest ?? 0}deg` }}
      aria-label={props.label}
      role={props.label ? "img" : undefined}
    >
      <div class="lp-scr">{props.children}</div>
      <img class="lp-bz" src={BEZEL_SRC} alt="" width={896} height={1831} decoding="async" />
      <For each={props.bubbles ?? []}>{(b) => <Bubble b={b} />}</For>
    </figure>
  );
}
