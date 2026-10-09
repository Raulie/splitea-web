import { Show, createSignal, type JSX } from "solid-js";
import { useLanding } from "./locales";
import { createMediaQuery } from "./motion";

export function DemoGate(props: { children: JSX.Element }) {
  const { copy } = useLanding();
  const coarse = createMediaQuery("(pointer: coarse)");
  const [open, setOpen] = createSignal(false);
  const gated = () => coarse() && !open();
  let tryButton: HTMLButtonElement | undefined;
  let doneButton: HTMLButtonElement | undefined;
  let content: HTMLDivElement | undefined;

  const ungate = () => {
    setOpen(true);
    queueMicrotask(() => {
      const focusable = content?.querySelector<HTMLElement>("button, a, [tabindex]");
      (focusable ?? doneButton)?.focus({ preventScroll: true });
    });
  };
  const regate = () => {
    setOpen(false);
    queueMicrotask(() => tryButton?.focus({ preventScroll: true }));
  };

  return (
    <div class="demo-gate-wrap">
      <div class="demo-gate" ref={content} inert={gated()} classList={{ "is-gated": gated() }}>
        {props.children}
      </div>
      <Show when={gated()}>
        <button ref={tryButton} type="button" class="demo-try" onClick={ungate}>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M6.2 1.5a1.3 1.3 0 0 1 1.3 1.3v4.5l3.6.6c1 .2 1.7 1.1 1.6 2.1l-.4 3.4c-.1.8-.8 1.4-1.6 1.4H7.4c-.5 0-1-.2-1.3-.6L3 10.3a1.1 1.1 0 0 1 1.6-1.5L5 9.2V2.8a1.3 1.3 0 0 1 1.2-1.3Z" fill="currentColor" />
          </svg>
          {copy.hero.tryIt}
        </button>
      </Show>
      <Show when={coarse() && open()}>
        <button ref={doneButton} type="button" class="demo-done" onClick={regate}>
          {copy.hero.done}
        </button>
      </Show>
    </div>
  );
}
