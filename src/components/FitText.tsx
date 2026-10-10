import { For, createEffect, createSignal, on, onCleanup, onMount } from "solid-js";

export function FitText(props: { variants: string[]; class?: string }) {
  const [index, setIndex] = createSignal(0);
  let box!: HTMLSpanElement;
  let probes!: HTMLSpanElement;

  const measure = () => {
    const available = box.getBoundingClientRect().width + 0.5;
    const widths = Array.from(probes.children, (probe) => probe.getBoundingClientRect().width);
    const fit = widths.findIndex((width) => width <= available);
    setIndex(fit === -1 ? Math.max(0, widths.length - 1) : fit);
  };

  onMount(() => {
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    void document.fonts?.ready.then(measure);
    onCleanup(() => observer.disconnect());
  });

  createEffect(on(() => props.variants.join("\n"), () => queueMicrotask(measure), { defer: true }));

  return (
    <span ref={box} class={`relative block min-w-0 ${props.class ?? ""}`}>
      <span
        ref={probes}
        aria-hidden="true"
        class="invisible absolute left-0 top-0 flex flex-col items-start whitespace-nowrap"
      >
        <For each={props.variants}>{(variant) => <span>{variant}</span>}</For>
      </span>
      <span class="block truncate">
        {props.variants[index()] ?? props.variants[props.variants.length - 1]}
      </span>
    </span>
  );
}
