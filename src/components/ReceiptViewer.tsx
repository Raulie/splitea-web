import { createSignal, onCleanup, onMount, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { CloseButton } from "./CloseButton";
import { DownloadButton } from "./DownloadButton";
import { NavBar } from "./NavBar";
import {
  receiptDownloadBasename,
  receiptDownloadExtension,
} from "../lib/format";

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
  /// Optional merchant name and receipt date — used by the
  /// download button to build a `Splitea - <Merchant> - <yyyy-
  /// MM-dd>.<ext>` filename matching iOS's
  /// `ReceiptFullscreenView.downloadBaseName`. Either may be
  /// nil; the helper falls back to `Splitea Receipt - <today>`
  /// when no merchant is set, and to today's date when no
  /// receipt date is set.
  merchantName?: string | null;
  receiptDateMs?: number | null;
  onClose: () => void;
}

/// Duration of the slide-up enter / slide-down exit animation
/// in ms. Match this with the CSS transition on `.ios-cover-*`
/// classes below — when the user dismisses, we trigger the
/// exit animation by flipping `presented` to false, then call
/// `props.onClose()` once this many ms have elapsed so the
/// parent unmounts only after the slide-down finishes.
const COVER_ANIMATION_MS = 320;

export function ReceiptViewer(props: ReceiptViewerProps) {
  const dataURL = () => `data:${props.mimeType};base64,${props.base64}`;
  const isPDF = () => props.mimeType.toLowerCase().includes("pdf");

  /// Drives the iOS `.fullScreenCover()`-style slide animation.
  /// Starts `false` so the first paint renders the cover at
  /// translateY(100%) (off-screen below); a `requestAnimationFrame`
  /// in `onMount` flips it to `true` on the next tick, which
  /// triggers the CSS transition to `translateY(0)`. The two-
  /// frame split (initial paint at 100% → next-frame transition
  /// to 0) is what makes the browser actually animate the
  /// transform rather than render the final state directly.
  const [presented, setPresented] = createSignal(false);
  /// True once the user has triggered dismiss but the slide-
  /// down animation is still running. We keep the cover
  /// mounted (the parent's `<Show>` is still true) until the
  /// slide-down completes, then call `props.onClose()` to
  /// flip the parent's flag and unmount.
  const [dismissing, setDismissing] = createSignal(false);

  const handleDismiss = () => {
    if (dismissing()) return;
    setDismissing(true);
    setPresented(false);
    setTimeout(() => props.onClose(), COVER_ANIMATION_MS);
  };

  /// Triggers a download with the same filename pattern iOS
  /// uses (`Splitea - <Merchant> - <yyyy-MM-dd>.<ext>`). The
  /// usual `<a download>` + click trick — Safari and Chrome
  /// both honor the `download` attribute on `data:` URLs for
  /// images and PDFs, so we don't need to round-trip through a
  /// blob. iOS Safari historically had quirks here but starting
  /// with iOS 13+ the download attribute on `data:` URLs Just
  /// Works for non-text/html mime types.
  const handleDownload = () => {
    const ext = receiptDownloadExtension(props.mimeType);
    const basename = receiptDownloadBasename(
      props.merchantName,
      props.receiptDateMs,
    );
    const filename = `${basename}.${ext}`;
    const a = document.createElement("a");
    a.href = dataURL();
    a.download = filename;
    // The element doesn't need to be in the DOM for `.click()`
    // to fire the download in Chrome/Edge/Firefox. Safari is
    // pickier and historically required the element to be in
    // the document tree — append briefly to be safe, then
    // remove. No flicker because the element has no visible
    // styling and is removed in the same tick.
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Dismiss on Esc — keyboard accessibility, and matches the
  // iOS sheet's swipe-down feel for users on hardware keyboards.
  onMount(() => {
    const handler = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") handleDismiss();
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

  // Trigger the present animation on the next paint.
  // Initial render: `presented = false` → the cover paints at
  // translateY(100%) (off-screen). Next frame: flip to true,
  // CSS transitions slide it to translateY(0). Without the
  // double-rAF, browsers may collapse the two states into one
  // paint and skip the animation.
  onMount(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setPresented(true));
    });
  });

  return (
    // `<Portal>` mounts the cover at the body root, OUTSIDE the
    // `.ios-nav-stack` whose `clip-path: inset(0 calc(50% - 220px))`
    // on desktop would otherwise mask the cover to the 440px
    // column — clipping the leading/trailing nav-bar buttons
    // (which sit at the column edges) entirely off-screen on
    // wide viewports. `position: fixed` already escapes layout
    // flow but NOT clip-path, hence the portal.
    <Portal>
    <div
      // `ios-nav-cover-*` classes drive the slide-up enter and
      // slide-down exit. Initial paint is `translate3d(0,100%,
      // 0)`; once `presented` flips to true on the next frame,
      // the CSS transition lerps to `translate3d(0,0,0)`. On
      // dismiss, `presented` flips back to false and the
      // transition reverses. Z-index 60 sits above the nav-
      // stack overlay (z-50) so the cover is the topmost
      // surface.
      class="fixed inset-0 z-[60] bg-ios-bg flex flex-col ios-nav-cover"
      classList={{ "ios-nav-cover-presented": presented() }}
      role="dialog"
      aria-modal="true"
      aria-label="Receipt viewer"
    >
      {/* Top chrome — uses the shared `NavBar` component for
          pixel-identical layout with the SavedReceiptView's
          edit-pencil header and the items-overlay back-button
          header (60pt body height, centered title, leading /
          trailing 44×44 buttons, `safe-px` horizontal gutter
          for landscape Dynamic Island clearance). The
          previous custom header here had its own padding
          stack (`px-4 pt-3 pb-3`) which produced a slightly
          different vertical inset and left-aligned the title
          — visibly inconsistent with the other two nav bars
          when the user moved between them. iOS-side this
          slot is the same `square.and.arrow.down` toolbar
          we'll wire up in a follow-up; for now the close
          button alone matches the read-only web feature set. */}
      <NavBar
        title="Receipt"
        leading={<DownloadButton onClick={handleDownload} />}
        trailing={<CloseButton onClick={handleDismiss} />}
      />

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
    </Portal>
  );
}
