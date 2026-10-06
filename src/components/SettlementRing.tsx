import { createEffect, createMemo, createSignal, For, on, onCleanup, onMount, Show } from "solid-js";
import { formatCurrency } from "../lib/format";
import { t } from "../lib/i18n";

export interface SettlementRingProps {
  progress: number;
  outstanding: number;
  currencyCode: string;
  caption: string;
  settledCount: number;
  debtorCount: number;
  allSettled: boolean;
}

const SIZE = 240;
const LINE = 22;
const RADIUS = (SIZE - LINE) / 2;
const CENTER_WIDTH = 150;
const FILL_MS = 350;
const CAP_RADIANS = LINE / 2 / RADIUS;
const HEAD_GRADIENT_OFFSET = CAP_RADIANS + (0.5 * Math.PI) / 180;

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const coord = (a: number, b: number, t: number) =>
    3 * a * t * (1 - t) ** 2 + 3 * b * t ** 2 * (1 - t) + t ** 3;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0;
    let hi = 1;
    let t = x;
    for (let i = 0; i < 24; i++) {
      const cx = coord(x1, x2, t);
      if (Math.abs(cx - x) < 1e-5) break;
      if (cx < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return coord(y1, y2, t);
  };
}

const easeInOut = cubicBezier(0.42, 0, 0.58, 1);

type RGB = [number, number, number];

function parseColor(value: string): RGB {
  const hex = value.trim().replace("#", "");
  if (/^[0-9a-f]{6}$/i.test(hex)) {
    return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)) as RGB;
  }
  const m = value.match(/\d+(\.\d+)?/g);
  if (m && m.length >= 3) return [Number(m[0]), Number(m[1]), Number(m[2])];
  return [10, 132, 255];
}

function shade([r, g, b]: RGB, brightness: number, saturation: number): string {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === r / 255) h = ((g - b) / 255 / d) % 6;
    else if (max === g / 255) h = (b - r) / 255 / d + 2;
    else h = (r - g) / 255 / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = Math.min(1, Math.max(0, (max === 0 ? 0 : d / max) + saturation));
  const v = Math.min(1, Math.max(0, max + brightness));
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const [r1, g1, b1] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const to = (n: number) => Math.round((n + v - c) * 255);
  return `rgb(${to(r1)}, ${to(g1)}, ${to(b1)})`;
}

function ringPalette() {
  const accent = parseColor(
    getComputedStyle(document.documentElement).getPropertyValue("--ios-blue") || "#0a84ff",
  );
  return {
    accent: `rgb(${accent.join(", ")})`,
    track: `rgba(${accent.join(", ")}, 0.15)`,
    head: shade(accent, 0.22, -0.12),
    tail: shade(accent, -0.16, 0.06),
  };
}

function drawRing(
  ctx: CanvasRenderingContext2D,
  percent: number,
  palette: ReturnType<typeof ringPalette>,
) {
  const p = Math.min(100, Math.max(0, percent));
  const c = SIZE / 2;
  const start = -Math.PI / 2;
  const end = start + (p / 100) * Math.PI * 2;
  const flat = typeof ctx.createConicGradient !== "function";
  const conic = (from: number) => {
    if (flat) return palette.accent;
    const g = ctx.createConicGradient(from, c, c);
    g.addColorStop(0, palette.tail);
    g.addColorStop(1, palette.head);
    return g;
  };

  ctx.clearRect(0, 0, SIZE, SIZE);
  ctx.lineWidth = LINE;

  ctx.beginPath();
  ctx.arc(c, c, RADIUS, 0, Math.PI * 2);
  ctx.lineCap = "butt";
  ctx.strokeStyle = palette.track;
  ctx.stroke();

  if (p <= 0) return;

  ctx.beginPath();
  ctx.arc(c, c, RADIUS, start, end);
  ctx.lineCap = "round";
  ctx.strokeStyle = conic(start);
  ctx.stroke();

  if (p > 0.5) {
    ctx.beginPath();
    ctx.arc(c, c - RADIUS, LINE / 2, 0, Math.PI * 2);
    ctx.fillStyle = flat ? palette.accent : palette.tail;
    ctx.fill();
  }

  const remaining = Math.PI * 2 - (p / 100) * Math.PI * 2;
  if (p >= 100 || RADIUS * remaining <= LINE) {
    ctx.beginPath();
    ctx.arc(c, c, RADIUS, end - CAP_RADIANS, end);
    ctx.lineCap = "round";
    ctx.strokeStyle = conic(start + HEAD_GRADIENT_OFFSET);
    ctx.stroke();
  }
}

function fitWidth(el: HTMLElement | undefined, baseSize: number) {
  if (!el) return;
  el.style.fontSize = `${baseSize}px`;
  const natural = el.scrollWidth;
  if (natural > CENTER_WIDTH) {
    el.style.fontSize = `${baseSize * Math.max(0.3, CENTER_WIDTH / natural)}px`;
  }
}

interface RollChar {
  ch: string;
  prev: string | null;
}

interface RollParts {
  head: RollChar[];
  core: RollChar[];
  tail: RollChar[];
}

const RTL = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF\u200F\u061C]/;

function splitAmount(text: string): [string, string, string] {
  const m = text.match(/^(\P{Nd}*)(.*?)(\P{Nd}*)$/u);
  return m ? [m[1] ?? "", m[2] ?? "", m[3] ?? ""] : ["", text, ""];
}

function diffChars(old: RollChar[], next: string, alignRight: boolean, animate: boolean): RollChar[] {
  const chars = [...next];
  const live = old.filter((c) => c.ch !== "");
  const offset = alignRight ? live.length - chars.length : 0;
  const out = chars.map((ch, i) => {
    const prior = live[i + offset];
    if (prior && prior.ch === ch) return prior.prev === null ? prior : { ch, prev: null };
    return { ch, prev: animate ? (prior?.ch ?? "") : null };
  });
  if (animate && alignRight && offset > 0) {
    return [...live.slice(0, offset).map((c) => ({ ch: "", prev: c.ch })), ...out];
  }
  if (animate && !alignRight && live.length > chars.length) {
    return [...out, ...live.slice(chars.length).map((c) => ({ ch: "", prev: c.ch }))];
  }
  return out;
}

function RollingText(props: { text: string; animate: boolean }) {
  const initial = splitAmount(props.text).map((part) =>
    [...part].map((ch) => ({ ch, prev: null })),
  );
  const [parts, setParts] = createSignal<RollParts>({
    head: initial[0]!,
    core: initial[1]!,
    tail: initial[2]!,
  });
  const chars = () => [...parts().head, ...parts().core, ...parts().tail];
  createEffect(
    on(
      () => props.text,
      (next, before) => {
        if (before === undefined || next === before) return;
        const [head, core, tail] = splitAmount(next);
        const old = parts();
        setParts({
          head: diffChars(old.head, head, false, props.animate),
          core: diffChars(old.core, core, true, props.animate),
          tail: diffChars(old.tail, tail, false, props.animate),
        });
      },
    ),
  );
  return (
    <Show
      when={!RTL.test(props.text)}
      fallback={<span aria-hidden="true">{props.text}</span>}
    >
      <span class="inline-flex whitespace-nowrap select-none" aria-hidden="true">
        <For each={chars()}>
          {(c) => (
            <span class="relative inline-block" classList={{ "ring-roll-ghost": c.ch === "" }}>
              <Show when={c.prev !== null}>
                <span class="ring-roll-out absolute inset-x-0 top-0 text-center">{c.prev}</span>
              </Show>
              <Show
                when={c.ch !== ""}
                fallback={<span class="invisible inline-block">{c.prev}</span>}
              >
                <span class="inline-block" classList={{ "ring-roll-in": c.prev !== null }}>
                  {c.ch}
                </span>
              </Show>
            </span>
          )}
        </For>
      </span>
    </Show>
  );
}

export function SettlementRing(props: SettlementRingProps) {
  let canvas: HTMLCanvasElement | undefined;
  let captionEl: HTMLDivElement | undefined;
  let amountEl: HTMLDivElement | undefined;
  let countEl: HTMLDivElement | undefined;
  let frame = 0;
  let shown = Math.min(1, Math.max(0, props.progress));
  let palette: ReturnType<typeof ringPalette> | null = null;
  const reduced = prefersReducedMotion();

  const [mounted, setMounted] = createSignal(false);
  const [checkmark, setCheckmark] = createSignal<"hidden" | "static" | "draw">(
    props.allSettled ? "static" : "hidden",
  );

  const paint = (value: number) => {
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !palette) return;
    const dpr = window.devicePixelRatio || 1;
    const px = Math.round(SIZE * dpr);
    if (canvas.width !== px) {
      canvas.width = px;
      canvas.height = px;
    }
    ctx.setTransform(px / SIZE, 0, 0, px / SIZE, 0, 0);
    drawRing(ctx, value * 100, palette);
  };

  const animateTo = (target: number) => {
    cancelAnimationFrame(frame);
    if (reduced) {
      shown = target;
      paint(shown);
      return;
    }
    const from = shown;
    const began = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - began) / FILL_MS);
      shown = k >= 1 ? target : from + (target - from) * easeInOut(k);
      paint(shown);
      if (k < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
  };

  const fitAll = () => {
    fitWidth(captionEl, 12);
    fitWidth(amountEl, 34);
    fitWidth(countEl, 11);
  };

  let resolution: MediaQueryList | undefined;
  const onResolution = () => {
    paint(shown);
    watchResolution();
  };
  const watchResolution = () => {
    resolution?.removeEventListener("change", onResolution);
    resolution = window.matchMedia?.(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    resolution?.addEventListener("change", onResolution);
  };

  onMount(() => {
    palette = ringPalette();
    paint(shown);
    watchResolution();
    fitAll();
    void document.fonts?.ready.then(fitAll);
    setMounted(true);
  });

  onCleanup(() => {
    cancelAnimationFrame(frame);
    resolution?.removeEventListener("change", onResolution);
  });

  const target = createMemo(() => Math.min(1, Math.max(0, props.progress)));
  const allSettled = createMemo(() => props.allSettled);
  let goal = shown;

  createEffect(
    on(
      target,
      (next) => {
        if (!mounted() || next === goal) return;
        goal = next;
        animateTo(next);
      },
      { defer: true },
    ),
  );

  createEffect(
    on(
      () => [props.caption, formatCurrency(props.outstanding, props.currencyCode), props.debtorCount, props.settledCount],
      () => queueMicrotask(fitAll),
      { defer: true },
    ),
  );

  let drawTimer: ReturnType<typeof setTimeout> | undefined;
  createEffect(
    on(
      allSettled,
      (settled) => {
        clearTimeout(drawTimer);
        if (!settled) {
          setCheckmark("hidden");
          return;
        }
        if (reduced) {
          setCheckmark("static");
          return;
        }
        drawTimer = setTimeout(() => {
          if (allSettled()) setCheckmark("draw");
        }, 150);
      },
      { defer: true },
    ),
  );
  onCleanup(() => clearTimeout(drawTimer));

  const amountText = () => formatCurrency(props.outstanding, props.currencyCode);

  return (
    <div class="relative mx-auto shrink-0" style={{ width: `${SIZE}px`, height: `${SIZE + 24}px` }}>
      <canvas
        ref={canvas}
        aria-hidden="true"
        class="absolute left-0 top-3"
        style={{ width: `${SIZE}px`, height: `${SIZE}px` }}
      />
      <div class="absolute inset-0 flex items-center justify-center">
        <div class="grid place-items-center" style={{ "max-width": `${CENTER_WIDTH}px` }}>
          <div
            class="settlement-ring-layer col-start-1 row-start-1 flex flex-col items-center gap-0.5"
            classList={{ "settlement-ring-layer-hidden": !allSettled() }}
            aria-hidden={!allSettled()}
          >
            <span class="relative block" style={{ width: "65px", height: "59px" }}>
              <Show when={checkmark() !== "hidden"}>
                <svg
                  width="65"
                  height="59"
                  viewBox="0 0 65 59"
                  aria-hidden="true"
                  class="absolute inset-0 text-ios-blue"
                  classList={{ "settlement-ring-check-draw": checkmark() === "draw" }}
                >
                  <polyline
                    points="11.6,30.2 25.5,49.1 52.4,9.3"
                    pathLength="1"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="8.9"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-dasharray="1"
                    stroke-dashoffset="0"
                  />
                </svg>
              </Show>
            </span>
            <span class="text-center text-[15px] leading-[18px] font-semibold text-ios-label">
              {t("ringAllSettled")}
            </span>
          </div>
          <div
            class="settlement-ring-layer col-start-1 row-start-1 flex flex-col items-center gap-0.5"
            classList={{ "settlement-ring-layer-hidden": allSettled() }}
            aria-hidden={allSettled()}
          >
            <div ref={captionEl} class="whitespace-nowrap leading-[1.25] text-ios-label-secondary">
              {props.caption}
            </div>
            <div ref={amountEl} class="settlement-ring-amount whitespace-nowrap text-ios-label">
              <span class="sr-only">{amountText()}</span>
              <RollingText text={amountText()} animate={mounted() && !reduced} />
            </div>
            <Show when={props.debtorCount > 1}>
              <div ref={countEl} class="whitespace-nowrap leading-[1.27] text-ios-label-secondary">
                {t("ringSettledCount", { settled: props.settledCount, total: props.debtorCount })}
              </div>
            </Show>
          </div>
        </div>
      </div>
    </div>
  );
}
