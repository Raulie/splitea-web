import { Match, Switch } from "solid-js";
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
  const label = () => {
    switch (props.state) {
      case "connecting":
        return "Connecting…";
      case "reconnecting":
        return "Reconnecting…";
      case "connected":
        return "Connected";
      case "offline":
        return "Offline";
      default:
        return "";
    }
  };

  /// Material/tint variant. The default neutral glass works
  /// for connecting/reconnecting; success and offline get
  /// tinted glass so the state communicates without color-
  /// blind-unsafe icon changes.
  const isSuccess = () => props.state === "connected";
  const isOffline = () => props.state === "offline";

  return (
    <div
      class="fixed left-1/2 z-[60] pointer-events-none"
      style={{
        // Top inset combines a 12pt baseline with the device
        // safe-area inset so the pill clears the notch /
        // Dynamic Island on iPhone Pro models.
        top: "calc(12px + env(safe-area-inset-top))",
        // Single transform handles both centering and the
        // enter/exit slide. Combining them in one value
        // means the transition stays smooth without fighting
        // a separate translateX rule.
        transform: visible()
          ? "translate(-50%, 0)"
          : "translate(-50%, -20px)",
        opacity: visible() ? "1" : "0",
        transition:
          "transform 220ms cubic-bezier(0.32, 0.72, 0, 1), opacity 220ms cubic-bezier(0.32, 0.72, 0, 1)",
      }}
      aria-live="polite"
      aria-atomic="true"
    >
      <div
        class="flex items-center gap-2 px-4 py-2 rounded-full"
        style={{
          "backdrop-filter": "blur(24px) saturate(180%)",
          "-webkit-backdrop-filter": "blur(24px) saturate(180%)",
          background: isSuccess()
            ? "rgba(48, 209, 88, 0.18)"
            : isOffline()
              ? "rgba(255, 69, 58, 0.18)"
              : "rgba(20, 20, 22, 0.7)",
          // Hairline border via inset shadow (so it stays
          // pixel-perfect over the rounded capsule corners
          // without subpixel issues a real `border` would
          // introduce on retina displays).
          "box-shadow": isSuccess()
            ? "inset 0 0 0 1px rgba(48, 209, 88, 0.35)"
            : isOffline()
              ? "inset 0 0 0 1px rgba(255, 69, 58, 0.35)"
              : "inset 0 0 0 1px rgba(255, 255, 255, 0.08)",
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
        border: "1.5px solid rgba(255, 255, 255, 0.25)",
        "border-top-color": "rgba(255, 255, 255, 0.95)",
        animation: "ios-pill-spin 700ms linear infinite",
      }}
      aria-hidden="true"
    />
  );
}

