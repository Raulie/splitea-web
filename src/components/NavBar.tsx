import type { JSX } from "solid-js";
import { Show } from "solid-js";

/// Custom Splitea-web navigation bar. Diverges from iOS 26's
/// pinned `.toolbar` layout in two intentional ways:
///
///   1. **Not pinned.** The bar scrolls away with the page so
///      readers reclaim ~64pt of vertical viewport when they
///      scroll past the top. iOS itself does this in some
///      contexts (Mail's compose view, certain modal sheets);
///      we make it the default here because every nav bar in
///      the app is a destination header, not a persistent
///      toolbar with running state the user needs at a glance.
///
///   2. **Taller body than the back button.** The button is
///      44pt (`w-11 h-11`); the bar's body is 60pt — the
///      extra 16pt distributes as 8pt above + 8pt below the
///      button via `flex items-center`. Bars without a
///      leading or trailing button still occupy the same
///      60pt so the title baseline sits at the same y across
///      every screen, regardless of which buttons are or
///      aren't present.
///
/// Total bar height equals exactly `BAR_BODY_HEIGHT` (60pt).
/// We don't add a `env(safe-area-inset-top)` pad on top
/// because in regular iOS Safari browsing the inset is `0`
/// anyway — Safari's URL bar already provides the visual
/// status-bar inset. If we ever ship a PWA / standalone
/// build (no browser chrome on the page), notched devices
/// would benefit from a `pt-[env(safe-area-inset-top)]`
/// wrapper here so content doesn't hide under the Dynamic
/// Island. Add it then, conditionally on display-mode, not
/// before — adding it now would make the bar 80pt+ in
/// browser mode, which the user explicitly didn't want.
export interface NavBarProps {
  title: string;
  /// Optional leading element — rendered at the left edge.
  /// Sized to fit a 44×44pt back button without crowding the
  /// title.
  leading?: JSX.Element;
  /// Optional trailing element — same slot on the right.
  trailing?: JSX.Element;
}

const BAR_BODY_HEIGHT = "60px";

export function NavBar(props: NavBarProps) {
  return (
    <div class="relative bg-ios-bg" style={{ height: BAR_BODY_HEIGHT }}>
      {/* Bar body — fixed 60pt height regardless of button
          presence so the title's vertical position stays
          consistent across screens with and without
          leading/trailing slots. The leading/trailing
          wrappers are always rendered (even when empty)
          to keep the flex layout balanced. */}
      <div class="absolute inset-0 px-4 flex items-center">
        <div class="flex items-center">
          <Show when={props.leading}>{props.leading}</Show>
        </div>
        <div class="flex-1" />
        <div class="flex items-center">
          <Show when={props.trailing}>{props.trailing}</Show>
        </div>
      </div>
      {/* Title centered absolutely inside the 60pt bar so it
          stays visually centered regardless of leading/
          trailing widths (a long Back button shouldn't push
          the title right). */}
      <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span class="text-ios-headline font-semibold text-ios-label truncate max-w-[60%]">
          {props.title}
        </span>
      </div>
    </div>
  );
}
