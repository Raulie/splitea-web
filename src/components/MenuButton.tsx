import { Show, createEffect, createSignal, onCleanup } from "solid-js";
import type { JSX } from "solid-js";
import { Portal } from "solid-js/web";

export interface MenuButtonProps {
  label: JSX.Element;
  class?: string;
  itemLabel: string;
  itemIcon: JSX.Element;
  destructive?: boolean;
  onSelect: () => void;
}

const MENU_WIDTH = 250;
const MENU_GAP = 6;
const EDGE = 8;

export function MenuButton(props: MenuButtonProps) {
  const [placement, setPlacement] = createSignal<{
    left: number;
    top: number;
    width: number;
    above: boolean;
  } | null>(null);
  let trigger!: HTMLButtonElement;
  let item: HTMLButtonElement | undefined;

  const open = () => {
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(MENU_WIDTH, window.innerWidth - EDGE * 2);
    const left = Math.min(Math.max(EDGE, rect.left - 16), window.innerWidth - width - EDGE);
    const above = rect.bottom + MENU_GAP + 64 > window.innerHeight;
    setPlacement({
      left,
      top: above ? rect.top - MENU_GAP : rect.bottom + MENU_GAP,
      width,
      above,
    });
  };

  const close = (restoreFocus: boolean) => {
    setPlacement(null);
    if (restoreFocus) trigger.focus({ preventScroll: true });
  };

  createEffect(() => {
    if (!placement()) return;
    queueMicrotask(() => item?.focus({ preventScroll: true }));
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Tab") {
        event.preventDefault();
        close(true);
      }
    };
    const dismiss = () => close(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    onCleanup(() => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
    });
  });

  return (
    <>
      <button
        ref={trigger}
        type="button"
        class={`active:opacity-60 transition-opacity ${props.class ?? ""}`}
        aria-haspopup="menu"
        aria-expanded={placement() !== null}
        onClick={() => (placement() ? close(true) : open())}
      >
        {props.label}
      </button>
      <Show when={placement()}>
        {(place) => (
          <Portal>
            <div
              class="fixed inset-0 z-[90]"
              aria-hidden="true"
              onClick={() => close(false)}
            />
            <div
              role="menu"
              class="ios-menu fixed z-[91] overflow-hidden"
              classList={{ "ios-menu-above": place().above }}
              style={{
                left: `${place().left}px`,
                top: `${place().top}px`,
                width: `${place().width}px`,
              }}
            >
              <button
                ref={item}
                type="button"
                role="menuitem"
                class="ios-menu-item flex w-full items-center gap-3 text-left text-ios-body"
                classList={{
                  "text-ios-red": props.destructive,
                  "text-ios-label": !props.destructive,
                }}
                onClick={() => {
                  close(true);
                  props.onSelect();
                }}
              >
                <span class="flex w-6 shrink-0 justify-center">{props.itemIcon}</span>
                <span class="min-w-0 flex-1">{props.itemLabel}</span>
              </button>
            </div>
          </Portal>
        )}
      </Show>
    </>
  );
}
