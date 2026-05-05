import { ChevronGlyph } from "./ChevronGlyph";

/// iOS 26-style circular back button. 44×44pt is Apple's
/// minimum tap target and matches the canonical iOS 26
/// nav-bar / toolbar back button outer diameter. The chevron
/// is `chevron.left` rendered at 17pt height — the SwiftUI
/// `.toolbar` icon-button default which corresponds to
/// `.body` font size.
///
/// Background uses our `ios-card` token (`#1c1c1e`) over the
/// black app bg, so the button reads as a slightly-lifted
/// dark circle. iOS 26's full LiquidGlass effect would
/// composite over a moving content area; on a static black
/// page the visual difference is negligible, and a solid bg
/// renders crisper at typical scroll positions.
export interface BackButtonProps {
  onClick: () => void;
  /// Optional override label for accessibility — defaults
  /// to "Back". iOS surfaces a dynamic prev-screen title in
  /// VoiceOver here; we don't carry that context yet on web.
  ariaLabel?: string;
}

export function BackButton(props: BackButtonProps) {
  return (
    <button
      type="button"
      class="w-11 h-11 rounded-full bg-ios-card flex items-center justify-center text-ios-label active:opacity-60 transition-opacity"
      aria-label={props.ariaLabel ?? "Back"}
      onClick={() => props.onClick()}
    >
      <ChevronGlyph size={17} />
    </button>
  );
}
