import { DownloadGlyph } from "./DownloadGlyph";

/// iOS 26-style circular download button. Matches the visual
/// pattern of `BackButton` / `EditButton` / `CloseButton` —
/// 44×44pt circle, `ios-card` lifted-dark background, white
/// glyph at 17pt — so any combination of these in the
/// leading/trailing slots of `NavBar` reads as a coherent
/// button row.
///
/// Used by `ReceiptViewer` to expose the iOS "Download
/// Receipt" toolbar action on the web.
export interface DownloadButtonProps {
  onClick: () => void;
  ariaLabel?: string;
}

export function DownloadButton(props: DownloadButtonProps) {
  return (
    <button
      type="button"
      class="w-11 h-11 rounded-full bg-ios-card flex items-center justify-center text-ios-label active:opacity-60 transition-opacity"
      aria-label={props.ariaLabel ?? "Download receipt"}
      onClick={() => props.onClick()}
    >
      <DownloadGlyph size={27} />
    </button>
  );
}
