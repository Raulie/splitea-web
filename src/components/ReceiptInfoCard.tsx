import { Show } from "solid-js";
import { formatReceiptDate, formatReceiptTime } from "../lib/format";

/// Receipt header card: merchant name on top with an optional
/// receipt-image trigger trailing it, divider, then "Date"
/// label with date + time pills aligned right. Mirrors the
/// iOS `receiptInfoSection` block in `ItemsView.swift`.
///
/// The receipt button only renders when the snapshot carries
/// a captured image / PDF — same condition iOS applies
/// (`viewModel.capturedImage != nil || viewModel.pdfData != nil`).
export interface ReceiptInfoCardProps {
  merchantName: string | null;
  receiptDate: number | null;
  /// True when the snapshot ships a `receiptImageBase64` so
  /// we can offer a tap-to-view affordance. Parent owns the
  /// modal state and the actual base64 payload.
  hasReceiptImage: boolean;
  /// Tap handler for the trailing receipt icon. Parent flips
  /// its `showingReceiptViewer` signal in response.
  onOpenReceipt?: () => void;
}

export function ReceiptInfoCard(props: ReceiptInfoCardProps) {
  return (
    <section class="bg-ios-card rounded-ios-card overflow-hidden">
      {/* iOS 26 padding: 24h / 20v — bumped from 16/16 to
          balance the larger 28pt corner radius. Inner pills
          use the `ios-tag` token (12pt) so they nest cleanly
          inside the 28pt outer card. */}
      <div class="px-4 py-4 flex items-center gap-3">
        <div class="flex-1 min-w-0 text-ios-label text-ios-body font-medium truncate">
          {props.merchantName ?? ""}
        </div>
        {/* iOS placement: same row as the merchant name, right
            edge, tinted with the system accent. iOS uses the
            built-in `receipt` SF Symbol; the web renders Apple's
            CoreSVG export verbatim. Sized at 22pt height (iOS
            body / SF Symbol default), with the natural
            ~0.77:1 aspect ratio honored. */}
        <Show when={props.hasReceiptImage}>
          <button
            type="button"
            class="shrink-0 text-ios-blue active:opacity-60 transition-opacity"
            aria-label="View Receipt"
            onClick={() => props.onOpenReceipt?.()}
          >
            <ReceiptIconGlyph size={22} />
          </button>
        </Show>
      </div>
      <div class="border-t border-ios-separator" />
      <div class="px-4 py-3 flex items-center gap-2">
        <span class="text-ios-label text-ios-body">Date</span>
        {/* Always render the date pills. When `receiptDate` is
            null (the OCR pipeline didn't extract one, or the
            iOS owner hasn't set it yet), fall back to the
            current device time — matches the iOS app's
            DatePicker binding `vm.receiptDate ?? Date()` so
            both clients show the same affordance.
            Note: this is a DISPLAY-only fallback; we don't
            persist `Date.now()` back to the receipt. The web
            client is read-only on this view, so the user
            can't change it from here regardless. */}
        {(() => {
          const ts = props.receiptDate ?? Date.now();
          return (
            <div class="ml-auto flex items-center gap-2">
              <span class="px-3 py-1.5 rounded-full bg-ios-card-hi text-ios-callout">
                {formatReceiptDate(ts)}
              </span>
              <span class="px-3 py-1.5 rounded-full bg-ios-card-hi text-ios-callout">
                {formatReceiptTime(ts)}
              </span>
            </div>
          );
        })()}
      </div>
    </section>
  );
}

/// SF Symbol `receipt` exported verbatim from Apple's
/// CoreSVG. Natural viewBox 20.0625 × 25.9536 (slight
/// portrait, ~0.77:1) — caller passes the desired height,
/// width is derived from the ratio. `currentColor` lets
/// the parent's text-color class tint the glyph.
function ReceiptIconGlyph(props: { size: number }) {
  const ratio = 20.0625 / 25.9536;
  const width = () => props.size * ratio;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20.0625 25.9536"
      width={width()}
      height={props.size}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M0 24.5374C0 25.7678 1.32422 26.4006 2.50781 25.592L3.92578 24.6663L5.49609 25.721C5.77734 25.9085 6.02344 25.9202 6.31641 25.721L7.86328 24.6545L9.43359 25.721C9.71484 25.9202 9.96094 25.9202 10.2539 25.721L11.8242 24.6545L13.3711 25.721C13.6875 25.9319 13.8867 25.9319 14.1914 25.721L15.7734 24.6663L17.2031 25.592C18.3867 26.4006 19.7109 25.7678 19.7109 24.5374L19.7109 4.04127C19.7109 1.62721 18.4922 0.408456 16.0312 0.408456L3.67969 0.408456C1.21875 0.408456 0 1.62721 0 4.04127ZM1.88672 23.8694L1.88672 4.14674C1.88672 2.92799 2.53125 2.29517 3.70312 2.29517L16.0078 2.29517C17.1797 2.29517 17.8242 2.92799 17.8242 4.14674L17.8125 23.8694L16.1602 22.7913C15.8906 22.6038 15.6328 22.6038 15.3633 22.7913L13.7812 23.8694L12.2344 22.7913C11.9648 22.6038 11.707 22.6038 11.4375 22.7913L9.84375 23.8694L8.26172 22.7913C7.99219 22.6038 7.73438 22.6038 7.46484 22.7913L5.90625 23.8694L4.32422 22.7913C4.05469 22.6038 3.79688 22.6038 3.52734 22.7913ZM4.94531 7.18189L10.8516 7.18189C11.2734 7.18189 11.5781 6.86549 11.5781 6.46705C11.5781 6.05689 11.2734 5.74049 10.8516 5.74049L4.94531 5.74049C4.52344 5.74049 4.21875 6.05689 4.21875 6.46705C4.21875 6.86549 4.52344 7.18189 4.94531 7.18189ZM13.7578 7.18189L14.7422 7.18189C15.1758 7.18189 15.4805 6.86549 15.4805 6.46705C15.4805 6.05689 15.1758 5.74049 14.7422 5.74049L13.7578 5.74049C13.3477 5.74049 13.0312 6.05689 13.0312 6.46705C13.0312 6.86549 13.3477 7.18189 13.7578 7.18189ZM4.94531 11.3655L10.8516 11.3655C11.2734 11.3655 11.5781 11.0608 11.5781 10.6624C11.5781 10.2522 11.2734 9.92408 10.8516 9.92408L4.94531 9.92408C4.52344 9.92408 4.21875 10.2522 4.21875 10.6624C4.21875 11.0608 4.52344 11.3655 4.94531 11.3655ZM13.7578 11.3655L14.7422 11.3655C15.1758 11.3655 15.4805 11.0608 15.4805 10.6624C15.4805 10.2522 15.1758 9.92408 14.7422 9.92408L13.7578 9.92408C13.3477 9.92408 13.0312 10.2522 13.0312 10.6624C13.0312 11.0608 13.3477 11.3655 13.7578 11.3655ZM4.94531 15.467L10.8633 15.467C11.2852 15.467 11.6016 15.1624 11.6016 14.7639C11.6016 14.3538 11.2852 14.0256 10.8633 14.0256L4.94531 14.0256C4.52344 14.0256 4.21875 14.3538 4.21875 14.7639C4.21875 15.1624 4.52344 15.467 4.94531 15.467ZM13.7461 15.467L14.7422 15.467C15.1758 15.467 15.4805 15.1624 15.4805 14.7639C15.4805 14.3538 15.1758 14.0256 14.7422 14.0256L13.7461 14.0256C13.3242 14.0256 13.0195 14.3538 13.0195 14.7639C13.0195 15.1624 13.3242 15.467 13.7461 15.467ZM4.94531 19.6624L10.8633 19.6624C11.2852 19.6624 11.6016 19.346 11.6016 18.9475C11.6016 18.5374 11.2852 18.221 10.8633 18.221L4.94531 18.221C4.52344 18.221 4.21875 18.5374 4.21875 18.9475C4.21875 19.346 4.52344 19.6624 4.94531 19.6624ZM13.7461 19.6624L14.7422 19.6624C15.1758 19.6624 15.4805 19.346 15.4805 18.9475C15.4805 18.5374 15.1758 18.221 14.7422 18.221L13.7461 18.221C13.3242 18.221 13.0195 18.5374 13.0195 18.9475C13.0195 19.346 13.3242 19.6624 13.7461 19.6624Z" />
    </svg>
  );
}
