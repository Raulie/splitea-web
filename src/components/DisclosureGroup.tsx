import { createSignal } from "solid-js";
import type { JSX } from "solid-js";

/// Expandable container — tap the summary to reveal the
/// content body, tap again to collapse. Mirrors SwiftUI
/// `DisclosureGroup` and the iOS `ContactBreakdownRow`'s
/// `withAnimation(.spring(duration: 0.3, bounce: 0.4)) {
/// isExpanded.toggle() }` behavior.
///
/// Animating `height: auto` is the long-standing CSS gap.
/// Common workarounds:
///   1. `grid-template-rows: 0fr → 1fr` — works everywhere
///      that supports CSS Grid (Safari 10+, Chrome 57+,
///      Firefox 52+); animates cleanly without measuring.
///   2. JS `getBoundingClientRect()` measure + animate
///      explicit `height` px — works but reflows on every
///      open and breaks if the content size changes mid-open.
///   3. `interpolate-size: allow-keywords` — the modern
///      `auto`-keyword animator, but Safari 17.4+ / Chrome
///      129+ only. Too new for the install base today.
///
/// We use #1. The content slot lives inside a single grid
/// row whose track size animates between 0fr and 1fr; the
/// inner `<div>` clips overflow so partially-visible content
/// stays nicely cropped during the transition.
export interface DisclosureGroupProps {
  /// Renders the always-visible header. Receives a SIGNAL
  /// GETTER for the current open state, not the raw boolean —
  /// the caller invokes `isOpen()` inside their JSX bindings
  /// (e.g. inside a `style` object) so only those bindings
  /// re-run on toggle. Passing the raw boolean would force
  /// Solid to re-invoke the whole summary function on every
  /// open/close, throwing away the existing DOM nodes and
  /// preventing CSS transitions on rotated chevrons or other
  /// open-state-driven properties from animating.
  summary: (isOpen: () => boolean) => JSX.Element;
  /// The expandable body. Hidden when collapsed.
  children: JSX.Element;
  /// Optional initial state. Defaults to collapsed. Ignored
  /// when `open` is provided (controlled mode).
  defaultOpen?: boolean;
  /// Optional controlled-mode flag. When set, this overrides
  /// the internal state and the parent owns expansion. Used
  /// by `SavedReceiptView`'s "Expand" button to flip every
  /// row in lockstep.
  open?: boolean;
  /// Called when the disclosure should toggle. Required when
  /// `open` is controlled (otherwise the parent has no way
  /// to react to taps); optional in self-managed mode.
  onOpenChange?: (next: boolean) => void;
  /// Class on the wrapping `<button>` for the summary so the
  /// caller can override padding / hover states.
  summaryClass?: string;
  /// Class on the body's inner content wrapper. The grid
  /// machinery on the outer wrapper is fixed; padding/etc.
  /// belong on the inner wrapper, NOT here.
  bodyClass?: string;
}

export function DisclosureGroup(props: DisclosureGroupProps) {
  const [internalOpen, setInternalOpen] = createSignal(
    props.defaultOpen ?? false,
  );
  const isOpen = () =>
    props.open !== undefined ? props.open : internalOpen();
  const toggle = () => {
    const next = !isOpen();
    if (props.open === undefined) setInternalOpen(next);
    props.onOpenChange?.(next);
  };
  return (
    <div>
      <button
        type="button"
        class={`w-full text-left active:opacity-80 transition-opacity ${
          props.summaryClass ?? ""
        }`}
        aria-expanded={isOpen()}
        onClick={toggle}
      >
        {props.summary(isOpen)}
      </button>
      <div
        class="grid"
        style={{
          // The 0fr → 1fr trick. iOS uses a 0.3s spring with
          // bounce 0.4; on the web we approximate with the
          // iOS interactive curve (no real spring in CSS) at
          // 280ms. That feels close to the SwiftUI reference
          // without the bounce overshoot which CSS can't
          // produce without a custom keyframe library.
          //
          // Children stay mounted in BOTH states. A previous
          // version wrapped them in `<Show when={isOpen}>`,
          // which unmounted on close and made the collapse
          // animation snap (the grid row had nothing to
          // animate against). The `overflow-hidden` parent
          // clips them when the row is at 0fr, so unmounting
          // is unnecessary — and removing it lets the same
          // CSS transition run in both directions.
          "grid-template-rows": isOpen() ? "1fr" : "0fr",
          transition: "grid-template-rows 280ms cubic-bezier(0.32, 0.72, 0, 1)",
        }}
      >
        <div class="overflow-hidden">
          <div class={props.bodyClass ?? ""}>{props.children}</div>
        </div>
      </div>
    </div>
  );
}
