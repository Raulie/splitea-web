import { For, Show, createEffect, createSignal, on, onCleanup, type Accessor, type Setter } from "solid-js";
import type { ContactPayload } from "../types/snapshot";
import { Avatar } from "./Avatar";
import { SpringValue, prefersReducedMotion, type Spring } from "../lib/spring";

const POP_ADDED: Spring = { duration: 0.35, bounce: 0.7 };
const POP_REMOVED: Spring = { duration: 0.35, bounce: 0.6 };
const SLIDE: Spring = { duration: 0.35, bounce: 0.35 };
const POP_ADDED_SCALE = 1.15;
const POP_REMOVED_SCALE = 0.85;
const POP_ADDED_HOLD_MS = 228;
const POP_REMOVED_HOLD_MS = 204;
const EXTRA_KEY = "+extra";

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

type Slot = {
  key: string;
  contact: Accessor<ContactPayload | undefined>;
  setContact: Setter<ContactPayload | undefined>;
  index: Accessor<number>;
  setIndex: Setter<number>;
  z: Accessor<number>;
  setZ: Setter<number>;
  cutout: Accessor<boolean>;
  setCutout: Setter<boolean>;
  extra: Accessor<number>;
  setExtra: Setter<number>;
  front: Accessor<"avatar" | "glyph">;
  setFront: Setter<"avatar" | "glyph">;
  leaving: boolean;
  el?: HTMLDivElement;
  avatarEl?: HTMLDivElement;
  glyphEl?: HTMLDivElement;
  x: SpringValue;
  scale: SpringValue;
  opacity: SpringValue;
  avatarAlpha: SpringValue;
  glyphAlpha: SpringValue;
};

function paint(slot: Slot) {
  if (!slot.el) return;
  slot.el.style.transform = `translateX(${slot.x.value}px) scale(${Math.max(0, slot.scale.value)})`;
  slot.el.style.opacity = String(clamp01(slot.opacity.value));
}

function paintLayers(slot: Slot) {
  if (slot.avatarEl) slot.avatarEl.style.opacity = String(clamp01(slot.avatarAlpha.value));
  if (slot.glyphEl) slot.glyphEl.style.opacity = String(clamp01(slot.glyphAlpha.value));
}

function makeSlot(key: string, contact?: ContactPayload): Slot {
  const [current, setContact] = createSignal(contact);
  const [index, setIndex] = createSignal(0);
  const [z, setZ] = createSignal(1);
  const [cutout, setCutout] = createSignal(false);
  const [extra, setExtra] = createSignal(0);
  const [front, setFront] = createSignal<"avatar" | "glyph">("avatar");
  const slot = {
    key,
    contact: current,
    setContact,
    index,
    setIndex,
    z,
    setZ,
    cutout,
    setCutout,
    extra,
    setExtra,
    front,
    setFront,
    leaving: false,
  } as Slot;
  slot.x = new SpringValue(0, () => paint(slot), 0.05);
  slot.scale = new SpringValue(1, () => paint(slot));
  slot.opacity = new SpringValue(1, () => paint(slot));
  slot.avatarAlpha = new SpringValue(1, () => paintLayers(slot));
  slot.glyphAlpha = new SpringValue(0, () => paintLayers(slot));
  return slot;
}

export function AssigneeIndicator(props: { assigned: ContactPayload[]; total: number; size: number }) {
  const overlap = () => props.size * 0.28;
  const ring = () => props.size * 0.06;
  const slotsByKey = new Map<string, Slot>();
  const [slots, setSlots] = createSignal<Slot[]>([]);
  let order: ContactPayload[] = [];
  let popEl: HTMLDivElement | undefined;
  let boxEl: HTMLDivElement | undefined;
  let emptyEl: SVGSVGElement | undefined;
  let popTimer: ReturnType<typeof setTimeout> | undefined;

  const pop = new SpringValue(1, (value) => {
    if (popEl) popEl.style.transform = value === 1 ? "" : `scale(${value})`;
  });
  const width = new SpringValue(props.size, (value) => {
    if (boxEl) boxEl.style.width = `${value}px`;
  }, 0.05);
  const empty = new SpringValue(1, (value) => {
    if (emptyEl) emptyEl.style.opacity = String(clamp01(value));
  });

  const single = (count: number) => count <= 1 || (props.total > 1 && count === props.total);

  const drop = (key: string) => {
    const slot = slotsByKey.get(key);
    if (!slot) return;
    for (const spring of [slot.x, slot.scale, slot.opacity, slot.avatarAlpha, slot.glyphAlpha]) spring.stop();
    slotsByKey.delete(key);
    setSlots([...slotsByKey.values()]);
  };

  const showFace = (slot: Slot, face: "avatar" | "glyph", spring: Spring | null) => {
    if (slot.front() === face) return;
    slot.setFront(face);
    const incoming = face === "glyph" ? slot.glyphAlpha : slot.avatarAlpha;
    const outgoing = face === "glyph" ? slot.avatarAlpha : slot.glyphAlpha;
    incoming.jump(1);
    outgoing.to(0, spring);
  };

  const layoutOf = (list: ContactPayload[]) => {
    const everyone = props.total > 1 && list.length === props.total;
    const visible = list.length <= 3 ? list : list.slice(0, 2);
    const extra = everyone ? 0 : list.length - visible.length;
    const shown = everyone ? visible.slice(-1) : visible;
    const keys = shown.map((contact) => contact.id);
    if (extra > 0) keys.push(EXTRA_KEY);
    return { everyone, extra, shown, keys, signature: `${everyone}|${keys.join(",")}|${extra}` };
  };
  let applied = "";

  const apply = (list: ContactPayload[], spring: Spring | null) => {
    const { everyone, extra, shown, keys, signature } = layoutOf(list);
    applied = signature;
    const pitch = props.size - overlap();

    keys.forEach((key, index) => {
      const contact = key === EXTRA_KEY ? undefined : shown[index];
      const x = index * pitch;
      let slot = slotsByKey.get(key);
      if (!slot) {
        slot = makeSlot(key, contact);
        slotsByKey.set(key, slot);
        slot.x.jump(x);
        showFace(slot, everyone ? "glyph" : "avatar", null);
      } else {
        if (slot.leaving) {
          slot.leaving = false;
          slot.scale.to(1, null);
          slot.opacity.to(1, null);
        }
        if (contact) slot.setContact(contact);
        slot.x.to(x, spring);
        showFace(slot, everyone ? "glyph" : "avatar", spring);
      }
      slot.setIndex(index);
      slot.setZ(index * 2 + 1);
      slot.setCutout(key !== EXTRA_KEY && !(index === shown.length - 1 && extra === 0));
      if (key === EXTRA_KEY) slot.setExtra(extra);
    });

    const live = new Set(keys);
    for (const [key, slot] of [...slotsByKey]) {
      if (live.has(key) || slot.leaving) continue;
      if (spring) {
        slot.leaving = true;
        slot.setZ(slot.index() * 2);
        if (list.length > 0) slot.scale.to(0, spring);
        slot.opacity.to(0, spring, () => drop(key));
      } else {
        drop(key);
      }
    }

    const count = keys.length;
    width.to(count > 0 ? count * props.size - (count - 1) * overlap() : props.size, spring);
    empty.jump(list.length > 0 ? 0 : 1);
    setSlots([...slotsByKey.values()]);
  };

  const bounce = (added: boolean) => {
    if (prefersReducedMotion()) return;
    const spring = added ? POP_ADDED : POP_REMOVED;
    pop.to(added ? POP_ADDED_SCALE : POP_REMOVED_SCALE, spring);
    clearTimeout(popTimer);
    popTimer = setTimeout(() => pop.to(1, spring), added ? POP_ADDED_HOLD_MS : POP_REMOVED_HOLD_MS);
  };

  const unique = (list: ContactPayload[]) => [...new Map(list.map((contact) => [contact.id, contact])).values()];

  order = unique([...props.assigned].reverse());
  apply(order, null);

  createEffect(
    on(
      () => props.assigned,
      (incoming) => {
        const assigned = unique(incoming);
        const byId = new Map(assigned.map((contact) => [contact.id, contact]));
        const next = order.filter((contact) => byId.has(contact.id)).map((contact) => byId.get(contact.id)!);
        const kept = new Set(next.map((contact) => contact.id));
        let added = false;
        for (const contact of assigned) {
          if (kept.has(contact.id)) continue;
          next.unshift(contact);
          kept.add(contact.id);
          added = true;
        }
        const before = order;
        order = next;
        const changed = next.length !== before.length || next.some((contact, i) => contact.id !== before[i].id);
        if (!changed) {
          for (const contact of next) slotsByKey.get(contact.id)?.setContact(contact);
          return;
        }
        if (next.length !== before.length && single(before.length) && single(next.length)) {
          bounce(next.length > before.length);
        }
        const bounceCarriesRemoval = !added && single(before.length) && single(next.length);
        apply(next, bounceCarriesRemoval ? null : SLIDE);
      },
      { defer: true },
    ),
  );

  createEffect(
    on(
      () => props.total,
      () => {
        if (layoutOf(order).signature !== applied) apply(order, null);
      },
      { defer: true },
    ),
  );

  onCleanup(() => {
    clearTimeout(popTimer);
    for (const spring of [pop, width, empty]) spring.stop();
    for (const key of [...slotsByKey.keys()]) drop(key);
  });

  const names = () =>
    props.assigned
      .map((contact) => contact.fullName?.trim())
      .filter(Boolean)
      .join(", ");

  return (
    <div class="relative shrink-0">
      <span class="sr-only">{names()}</span>
      <div ref={popEl} aria-hidden="true">
        <div ref={boxEl} class="relative" style={{ width: `${width.value}px`, height: `${props.size}px` }}>
          <svg
            ref={emptyEl}
            class="absolute left-0 top-0"
            width={props.size}
            height={props.size}
            viewBox={`0 0 ${props.size} ${props.size}`}
            style={{ opacity: String(clamp01(empty.value)) }}
          >
            <circle
              cx={props.size / 2}
              cy={props.size / 2}
              r={(props.size - 1.5) / 2}
              fill="none"
              stroke="var(--ios-label)"
              stroke-opacity="0.25"
              stroke-width="1.5"
              stroke-dasharray="4 3"
            />
          </svg>
          <For each={slots()}>
            {(slot) => <SlotView slot={slot} size={props.size} overlap={overlap()} ring={ring()} />}
          </For>
        </div>
      </div>
    </div>
  );
}

function SlotView(props: { slot: Slot; size: number; overlap: number; ring: number }) {
  const slot = props.slot;
  const mask = () => {
    if (!slot.cutout()) return "none";
    const radius = props.size / 2 + props.ring;
    const cx = props.size * 1.5 - props.overlap;
    const cy = props.size / 2;
    return `radial-gradient(circle ${radius}px at ${cx}px ${cy}px, transparent ${radius - 0.3}px, #000 ${radius + 0.3}px)`;
  };
  return (
    <div
      ref={(el) => {
        slot.el = el;
        paint(slot);
      }}
      class="absolute left-0 top-0"
      style={{ width: `${props.size}px`, height: `${props.size}px`, "z-index": slot.z() }}
    >
      <Show when={slot.key !== EXTRA_KEY} fallback={<ExtraBubble slot={slot} size={props.size} />}>
        <div class="relative w-full h-full rounded-full" style={{ "-webkit-mask-image": mask(), "mask-image": mask() }}>
          <div
            ref={(el) => {
              slot.avatarEl = el;
              paintLayers(slot);
            }}
            class="absolute inset-0"
            style={{ "z-index": slot.front() === "avatar" ? 1 : 0 }}
          >
            <Avatar size={props.size} fullName={slot.contact()?.fullName ?? null} imageURL={slot.contact()?.avatarUrl ?? null} />
          </div>
          <div
            ref={(el) => {
              slot.glyphEl = el;
              paintLayers(slot);
            }}
            class="absolute inset-0"
            style={{ "z-index": slot.front() === "glyph" ? 1 : 0 }}
          >
            <Avatar size={props.size} variant="everyone" />
          </div>
        </div>
      </Show>
    </div>
  );
}

function ExtraBubble(props: { slot: Slot; size: number }) {
  let textEl: HTMLSpanElement | undefined;
  createEffect(
    on(
      props.slot.extra,
      (next, previous) => {
        if (!textEl || previous === undefined || next === previous) return;
        if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        const from = next > previous ? "40%" : "-40%";
        textEl.animate(
          [
            { transform: `translateY(${from})`, opacity: 0, filter: "blur(2px)" },
            { transform: "none", opacity: 1, filter: "none" },
          ],
          { duration: 350, easing: "cubic-bezier(0.2, 0.9, 0.3, 1.1)" },
        );
      },
      { defer: true },
    ),
  );
  return (
    <div
      class="w-full h-full rounded-full bg-ios-gray-fill text-white font-semibold flex items-center justify-center"
      style={{ "font-size": `${Math.round(props.size * 0.4)}px` }}
    >
      <span ref={textEl}>{`+${props.slot.extra()}`}</span>
    </div>
  );
}
