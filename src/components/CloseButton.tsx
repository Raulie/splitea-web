import { XmarkGlyph } from "./XmarkGlyph";

/// iOS 26-style circular close button. Visually identical
/// to `BackButton` (44×44pt circle, `ios-card` fill, white
/// glyph) — they ship as a matched pair on iOS toolbars and
/// the only difference is the SF Symbol inside (`chevron.left`
/// vs `xmark`).
///
/// Used by `ReceiptViewer` and other modal-dismissal contexts
/// where the iOS pattern is "close" rather than "back". Same
/// 17pt body-size glyph so the two buttons look weight-
/// matched when they sit side-by-side in a nav bar.
export interface CloseButtonProps {
  onClick: () => void;
  ariaLabel?: string;
}

export function CloseButton(props: CloseButtonProps) {
  return (
    <button
      type="button"
      class="w-11 h-11 rounded-full bg-ios-card flex items-center justify-center text-ios-label active:opacity-60 transition-opacity"
      aria-label={props.ariaLabel ?? "Close"}
      onClick={() => props.onClick()}
    >
      <XmarkGlyph size={17} />
    </button>
  );
}
