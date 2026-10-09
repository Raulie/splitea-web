import { For, Show, splitProps, type JSX } from "solid-js";
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

export type PillIcon = "location" | "globe" | "share" | "dot";

export function Pill(props: {
  n?: number;
  text: string;
  icon?: PillIcon;
  rate?: string;
  class?: string;
  style?: JSX.CSSProperties;
  on?: boolean;
}) {
  const variant = () =>
    props.n !== undefined ? "lp-pill--badge" : props.rate ? "lp-pill--rate" : props.icon ? "lp-pill--icon" : "";
  return (
    <span class={`lp-pill ${variant()} ${props.class ?? ""}`} style={props.style} data-on={props.on ? "" : undefined}>
      <Show when={props.n !== undefined}>
        <span class="lp-pill-n">{props.n}</span>
      </Show>
      <Show when={props.icon === "location"}>
        <svg class="lp-pill-glyph lp-pill-glyph--location" viewBox="0 0 20.8547 19.0403" aria-hidden="true">
          <path
            d="M1.33653 10.172 8.70417 10.2023C8.85577 10.2023 8.9063 10.2529 8.9063 10.4045L8.92651 17.7115C8.92651 19.2173 10.7356 19.571 11.4127 18.1056L18.8815 2.04639C19.5586.570847 18.3963-.399377 16.9814.257546L.831202 7.74647C-.46243 8.34275-.209767 10.1619 1.33653 10.172Z"
            fill="currentColor"
          />
        </svg>
      </Show>
      <Show when={props.icon === "globe"}>
        <svg class="lp-pill-glyph" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true">
          <circle cx="8" cy="8" r="6.3" />
          <path d="M1.7 8h12.6M8 1.7c1.8 1.7 2.7 3.8 2.7 6.3S9.8 12.6 8 14.3C6.2 12.6 5.3 10.5 5.3 8S6.2 3.4 8 1.7Z" />
        </svg>
      </Show>
      <Show when={props.icon === "dot"}>
        <span class="lp-pill-dot" />
      </Show>
      <span class="lp-pill-text">{props.text}</span>
      <Show when={props.rate}>
        <span class="lp-pill-rate">{props.rate}</span>
      </Show>
      <Show when={props.icon === "share"}>
        <svg class="lp-pill-glyph" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M8 10V1.8M5.2 4.4 8 1.6l2.8 2.8M5.6 6.6H4.4c-.8 0-1.4.6-1.4 1.4v5c0 .8.6 1.4 1.4 1.4h7.2c.8 0 1.4-.6 1.4-1.4V8c0-.8-.6-1.4-1.4-1.4h-1.2" />
        </svg>
      </Show>
    </span>
  );
}

export type Shot = { slug: string; widths?: number[]; webp?: number };

export function ShotPicture(props: {
  shot: Shot;
  sizes: string;
  alt?: string;
  width?: number;
  height?: number;
  class?: string;
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
        loading="lazy"
        decoding="async"
      />
    </picture>
  );
}

export function PhoneShot(props: {
  pw: string;
  class?: string;
  style?: JSX.CSSProperties;
  label?: string;
  children: JSX.Element;
}) {
  const [local] = splitProps(props, ["pw", "class", "style", "label", "children"]);
  return (
    <figure
      class={`phone-shot ${local.class ?? ""}`}
      style={{ "--pw": local.pw, ...(local.style ?? {}) }}
      aria-label={local.label}
      role={local.label ? "img" : undefined}
    >
      <div class="phone-shot-screen">
        {local.children}
        <span class="phone-shot-island" aria-hidden="true" />
      </div>
      <img class="phone-shot-bezel" src={BEZEL_SRC} alt="" width={896} height={1831} decoding="async" />
    </figure>
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

export function Tagline(props: { text: string; class?: string }) {
  return <p class={`lp-tagline ${props.class ?? ""}`}>{props.text}</p>;
}
