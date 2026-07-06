import { Show, onCleanup, createEffect } from "solid-js";
import { Portal } from "solid-js/web";

export interface IOSAlertProps {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/// A faithful port of the iOS UIAlertController two-button alert: a
/// centered ~270pt material panel with a hairline-split action row,
/// blue text actions, and the preferred (confirm) action bold. Drives
/// the "Did you pay <payer>?" return prompt, mirroring the iOS Pay-menu
/// confirmation in `BreakdownSectionsView`.
export function IOSAlert(props: IOSAlertProps) {
  createEffect(() => {
    if (!props.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onCancel();
      else if (e.key === "Enter") props.onConfirm();
    };
    window.addEventListener("keydown", onKey);
    onCleanup(() => window.removeEventListener("keydown", onKey));
  });

  return (
    <Show when={props.open}>
      <Portal>
        <div class="fixed inset-0 z-[100] flex items-center justify-center px-11">
          <div
            class="ios-alert-scrim absolute inset-0 bg-black/25"
            aria-hidden="true"
            onClick={() => props.onCancel()}
          />
          <div
            class="ios-alert-panel relative w-[270px] max-w-full overflow-hidden rounded-[14px] text-center"
            role="alertdialog"
            aria-modal="true"
            aria-label={props.title}
          >
            <div class="px-4 pt-[19px] pb-[15px]">
              <div class="text-[17px] font-semibold leading-[21px] text-ios-label">
                {props.title}
              </div>
              <Show when={props.message}>
                <div class="mt-[3px] text-[13px] leading-[18px] text-ios-label">
                  {props.message}
                </div>
              </Show>
            </div>
            <div class="h-px w-full bg-ios-separator" />
            <div class="flex items-stretch">
              <button
                type="button"
                class="ios-alert-btn flex-1 text-[17px] text-ios-blue"
                onClick={() => props.onCancel()}
              >
                {props.cancelLabel}
              </button>
              <div class="w-px self-stretch bg-ios-separator" />
              <button
                type="button"
                class="ios-alert-btn flex-1 text-[17px] font-semibold text-ios-blue"
                onClick={() => props.onConfirm()}
              >
                {props.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      </Portal>
    </Show>
  );
}
