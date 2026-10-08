import { createSignal, onCleanup, type Accessor } from "solid-js";
import { isServer } from "solid-js/web";

export function createMediaQuery(query: string): Accessor<boolean> {
  if (isServer) return () => false;
  const mql = window.matchMedia(query);
  const [matches, setMatches] = createSignal(mql.matches);
  const update = (e: MediaQueryListEvent) => setMatches(e.matches);
  mql.addEventListener("change", update);
  onCleanup(() => mql.removeEventListener("change", update));
  return matches;
}

export const createReducedMotion = () => createMediaQuery("(prefers-reduced-motion: reduce)");

export function createPageVisible(): Accessor<boolean> {
  if (isServer) return () => true;
  const [visible, setVisible] = createSignal(document.visibilityState === "visible");
  const update = () => setVisible(document.visibilityState === "visible");
  document.addEventListener("visibilitychange", update);
  onCleanup(() => document.removeEventListener("visibilitychange", update));
  return visible;
}

export function observeOnce(el: Element, onEnter: () => void, rootMargin = "0px"): () => void {
  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        onEnter();
      }
    },
    { rootMargin },
  );
  io.observe(el);
  return () => io.disconnect();
}

let revealObserver: IntersectionObserver | undefined;

export function reveal(el: HTMLElement) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  el.dataset.reveal = "pending";
  revealObserver ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        (entry.target as HTMLElement).dataset.reveal = "done";
        revealObserver?.unobserve(entry.target);
      }
    },
    { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
  );
  revealObserver.observe(el);
}

export function smoothBehavior(): ScrollBehavior {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}
