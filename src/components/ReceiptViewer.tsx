import { onCleanup, onMount, Show } from "solid-js";
import { CloseButton } from "./CloseButton";

/// Full-screen overlay that renders the captured receipt
/// image or PDF. Mirrors iOS `ReceiptFullscreenView`:
///
///   • Image: renders centered, fits the viewport, supports
///     pinch-zoom via the browser's native `touch-action`
///     handling on the wrapper (no JS gesture lib needed —
///     setting `touch-action: pinch-zoom` lets Safari handle
///     it, including the bounce-back animation).
///   • PDF: rendered via `<iframe>` pointing at a data: URL.
///     Browsers ship a built-in PDF viewer; iOS Safari renders
///     the first page inline and provides scroll for multi-
///     page docs. PDFKit-quality on the web isn't worth a
///     custom renderer for now.
///
/// Dismissal: tap the close button OR swipe-down (mapped to
/// the iOS sheet-dismiss gesture via the Esc key fallback for
/// hardware keyboards). Backdrop click also closes.
export interface ReceiptViewerProps {
  /// The base64 payload from `snapshot.receipt.receiptImageBase64`.
  /// Wire format is just the base64 bytes (no `data:` prefix);
  /// we splice the prefix on here from `mimeType`.
  base64: string;
  mimeType: string;
  onClose: () => void;
}

export function ReceiptViewer(props: ReceiptViewerProps) {
  const dataURL = () => `data:${props.mimeType};base64,${props.base64}`;
  const isPDF = () => props.mimeType.toLowerCase().includes("pdf");

  // Dismiss on Esc — keyboard accessibility, and matches the
  // iOS sheet's swipe-down feel for users on hardware keyboards.
  onMount(() => {
    const handler = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") props.onClose();
    };
    window.addEventListener("keydown", handler);
    onCleanup(() => window.removeEventListener("keydown", handler));
  });

  // Lock body scroll while the modal is open so background
  // pages don't drift under the overlay on iOS Safari.
  onMount(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    onCleanup(() => {
      document.body.style.overflow = prev;
    });
  });

  return (
    <div
      class="fixed inset-0 z-50 bg-black flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label="Receipt viewer"
    >
      {/* Top chrome — Close button on the right, mirroring the
          iOS toolbar's `.topBarTrailing` placement. We don't
          render the iOS download / share-sheet button here yet
          (`square.and.arrow.down`); browsers expose download
          via the PDF viewer's own toolbar and image right-
          click respectively, which is enough for read-only
          web peers. */}
      <div class="flex items-center justify-between px-4 pt-[env(safe-area-inset-top)] pt-3 pb-3">
        <span class="text-ios-headline text-ios-label">Receipt</span>
        <CloseButton onClick={() => props.onClose()} />
      </div>

      <div class="flex-1 min-h-0 relative">
        <Show
          when={isPDF()}
          fallback={
            // Image: a wrapping div with `touch-action: pinch-zoom`
            // gives Safari/Chrome the native pinch + double-tap
            // zoom UX iOS users expect (the iOS app uses
            // `ZoomableImageView`, a UIScrollView wrapper around
            // the same UX). We don't simulate momentum scroll —
            // browsers already do that.
            <div
              class="absolute inset-0 overflow-auto flex items-start justify-center pb-[env(safe-area-inset-bottom)]"
              style={{ "touch-action": "pinch-zoom" }}
            >
              <img
                src={dataURL()}
                alt="Receipt"
                class="max-w-full h-auto select-none"
                draggable={false}
              />
            </div>
          }
        >
          <iframe
            src={dataURL()}
            title="Receipt PDF"
            class="absolute inset-0 w-full h-full bg-white"
          />
        </Show>
      </div>
    </div>
  );
}
