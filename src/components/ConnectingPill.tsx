import { createEffect, createSignal, Match, Switch } from "solid-js";
import { CheckmarkGlyph } from "./CheckmarkGlyph";
import { WifiSlashGlyph } from "./WifiSlashGlyph";

/// Status pill that surfaces the WebSocket connection state.
/// Visible while connecting / reconnecting / offline; flashes a
/// green "Connected" confirmation for 800ms after the socket
/// opens, then auto-hides. Position-fixed top-center so it
/// doesn't compete with the bottom contacts row, scrolls with
/// nothing, and survives the iOS-style push transition into
/// `SavedReceiptView`.
///
/// The visual matches the iOS 26 / Liquid Glass system pills
/// (Maps "Updating Location", AirDrop "Searching…") — capsule
/// shape, frosted-glass material, hairline edge, spinner +
/// short text. Pure CSS spinner so we don't ship an animated
/// asset for one tiny ring.
///
/// `pointer-events-none` so the pill is purely informational
/// and never blocks taps on the page beneath it.
export type ConnectingPillState =
  | "connecting"
  | "reconnecting"
  | "connected"
  | "offline"
  | "hidden";

export interface ConnectingPillProps {
  state: ConnectingPillState;
}

export function ConnectingPill(props: ConnectingPillProps) {
  const visible = () => props.state !== "hidden";

  /// Last non-hidden state — the label, icon, and tint all
  /// read from THIS rather than `props.state` directly so the
  /// pill's content stays put while it slides out on dismiss.
  /// Without this, when `props.state` flips to `"hidden"` the
  /// label collapsed to `""` and the icon fell back to the
  /// spinner instantly (in the same frame that the slide-up
  /// started), making the pill appear to scale down + fly up
  /// rather than just translating cleanly. Holding the
  /// previous state's content for the duration of the slide
  /// produces a pure-translate exit animation, matching
  /// OnsenUI's `AscendToastAnimator`.
  type VisibleState = Exclude<ConnectingPillState, "hidden">;
  const initialVisibleState: VisibleState =
    props.state === "hidden" ? "connecting" : props.state;
  const [lastVisibleState, setLastVisibleState] =
    createSignal<VisibleState>(initialVisibleState);
  createEffect(() => {
    if (props.state !== "hidden") {
      setLastVisibleState(props.state);
    }
  });

  const label = () => {
    switch (lastVisibleState()) {
      case "connecting":
        return "Connecting…";
      case "reconnecting":
        return "Reconnecting…";
      case "connected":
        return "Connected";
      case "offline":
        return "Offline";
    }
  };

  /// Material/tint variant. The default neutral glass works
  /// for connecting/reconnecting; success and offline get
  /// tinted glass so the state communicates without color-
  /// blind-unsafe icon changes. Reads from `lastVisibleState`
  /// for the same reason as `label` — the pill's tint shouldn't
  /// flicker mid-slide on dismiss.
  const isSuccess = () => lastVisibleState() === "connected";
  const isOffline = () => lastVisibleState() === "offline";

  return (
    <div
      class="fixed left-1/2 z-[60] pointer-events-none"
      style={{
        // Top inset combines a 12pt baseline with the device
        // safe-area inset so the pill clears the notch /
        // Dynamic Island on iPhone Pro models.
        top: "calc(12px + env(safe-area-inset-top))",
        // Show / hide animation parameters ported from OnsenUI's
        // `AscendToastAnimator` (`core/src/elements/ons-toast/
        // ascend-toast-animator.js`):
        //   • duration: 400ms (OnsenUI default 0.4s)
        //   • timing:   cubic-bezier(.1, .7, .1, 1)
        //   • show:     translateY(-100%) → translateY(0)
        //   • hide:     translateY(0)     → translateY(-100%)
        // OnsenUI's `-100%` translates by the element's OWN
        // height — for a ~30pt-tall pill that's only -30pt,
        // not enough to fully hide it when it's positioned
        // 12pt + env(inset-top) below the viewport top. We
        // extend the hidden-state translate via `calc()` so
        // the pill ends up above the viewport edge with no
        // peek. The `-50%` X-axis half handles centering;
        // both axes move on a single `transform` so the
        // transition doesn't fight a separate `translateX`.
        // No opacity fade — OnsenUI's ascend is a pure slide.
        transform: visible()
          ? "translate(-50%, 0)"
          : "translate(-50%, calc(-100% - 12px - env(safe-area-inset-top)))",
        transition:
          "transform 400ms cubic-bezier(.1, .7, .1, 1)",
      }}
      aria-live="polite"
      aria-atomic="true"
    >
      <div
        class="flex items-center gap-2 px-4 py-2 rounded-full"
        style={{
          "backdrop-filter": "blur(24px) saturate(180%)",
          "-webkit-backdrop-filter": "blur(24px) saturate(180%)",
          // Single neutral-glass surface across every state.
          // Earlier iterations tinted the bg + border green
          // when connected and red when offline, but that read
          // as a state-of-the-pill change rather than a state-
          // of-the-connection one — and visually fought with
          // the icon swap that already communicates the same
          // information. Keeping the surface constant means
          // only the ICON tint shifts (green check / red wifi-
          // slash / neutral spinner), which is the same pattern
          // iOS 26 system pills use (Maps "Updating Location"
          // stays neutral whether the lock is in progress or
          // just succeeded — only the inline glyph changes).
          // Mode-aware translucent capsule, defined in
          // `src/index.css` as `--ios-toast-bg` /
          // `--ios-toast-border`. Light mode lands a near-
          // white translucent surface so the pill reads as a
          // light material on top of the page; dark mode keeps
          // the previous near-black material. The hardcoded
          // dark values that used to be here showed up as a
          // black slab in light mode regardless of the rest
          // of the page being white.
          background: "var(--ios-toast-bg)",
          // Hairline border via inset shadow (so it stays
          // pixel-perfect over the rounded capsule corners
          // without subpixel issues a real `border` would
          // introduce on retina displays).
          "box-shadow": "inset 0 0 0 1px var(--ios-toast-border)",
        }}
      >
        {/* Per-state glyph. The spinner is pure CSS (animated
            ring) and only fires for in-flight states; the
            terminal states get static SF-Symbol glyphs so the
            user sees a clear "we've stopped trying" signal
            instead of a misleading "still spinning". Tints
            are inherited via `currentColor` from inline
            `style.color` set on each branch. */}
        <Switch fallback={<Spinner size={14} />}>
          <Match when={isSuccess()}>
            <span
              class="inline-flex shrink-0"
              style={{ color: "rgb(48, 209, 88)" }}
            >
              <CheckmarkGlyph size={14} />
            </span>
          </Match>
          <Match when={isOffline()}>
            <span
              class="inline-flex shrink-0"
              style={{ color: "rgb(255, 69, 58)" }}
            >
              <WifiSlashGlyph size={14} />
            </span>
          </Match>
        </Switch>
        <span class="text-ios-footnote font-medium text-ios-label leading-none">
          {label()}
        </span>
      </div>
    </div>
  );
}

/// Pure-CSS spinner — a thin ring with one quadrant
/// highlighted, rotating via the `ios-pill-spin` keyframe
/// declared in `index.css`. Same look Apple uses for inline
/// progress in Maps / AirDrop pills.
function Spinner(props: { size: number }) {
  return (
    <span
      class="inline-block rounded-full shrink-0"
      style={{
        width: `${props.size}px`,
        height: `${props.size}px`,
        // Mode-aware ring colors so the spinner contrasts
        // against the pill's material in both light + dark.
        // Light: dark ring on white pill. Dark: white ring on
        // dark pill. Defined alongside the pill bg in
        // index.css under `--ios-toast-spinner-*`.
        border: "1.5px solid var(--ios-toast-spinner-base)",
        "border-top-color": "var(--ios-toast-spinner-arc)",
        animation: "ios-pill-spin 700ms linear infinite",
      }}
      aria-hidden="true"
    />
  );
}

