import type { JSX } from "solid-js";

/// Photorealistic iPhone shell for the marketing hero.
///
/// Deliberately a DUMB SLOT: it knows nothing about
/// `ReceiptSnapshot`, `LiveSession` or routing. Whatever is
/// handed to `children` is mounted inside `.device-app`, which
/// is the containing block (and paint clip) for the app's
/// `position: fixed` chrome — see the `.device-*` block in
/// `index.css` for why that one declaration is load-bearing.
///
/// The browser chrome (status bar + address pill) is drawn ON
/// PURPOSE. The hero's whole claim is "your friends open a
/// LINK, no app" — app content butting straight against a
/// Dynamic Island reads as a native-app screenshot and quietly
/// contradicts the copy. It also reserves the ~59pt a real
/// device spends on the status bar, which is what keeps the
/// island off the editor's "Assign items" title (a browser page
/// lays out at y=0; a phone does not).
///
/// All geometry derives from one custom property, `--dw` (the
/// screen's width in px), set in CSS. Rail, bezel, radii,
/// button offsets and the app's substituted viewport height are
/// all `calc()`s off it, so the phone stays proportional at
/// every breakpoint with no JS measuring and no `transform:
/// scale()` (which would shrink 15px body text into
/// illegibility and freeze layout at one hard-coded width).
export function DeviceFrame(props: {
  children: JSX.Element;
  /// Text shown in the fake address bar. Defaults to the real
  /// host so the hero matches what a recipient sees.
  url?: string;
  /// Accessible name for the whole device group.
  label?: string;
}) {
  return (
    <div class="device-stage">
      <div
        class="device-frame"
        role="figure"
        aria-label={props.label ?? "The page your friends open in their browser"}
      >
        <i class="device-btn device-btn--left device-btn--action" aria-hidden="true" />
        <i class="device-btn device-btn--left device-btn--vol-up" aria-hidden="true" />
        <i class="device-btn device-btn--left device-btn--vol-down" aria-hidden="true" />
        <i class="device-btn device-btn--right device-btn--side" aria-hidden="true" />

        <div class="device-bezel">
          <div class="device-screen">
            <div class="device-chrome" aria-hidden="true">
              <div class="device-status">
                <span class="device-time">9:41</span>
                <span class="device-status-icons">
                  <svg viewBox="0 0 18 12" class="device-glyph" fill="currentColor">
                    <rect x="0" y="8" width="3" height="4" rx="1" />
                    <rect x="5" y="5.5" width="3" height="6.5" rx="1" />
                    <rect x="10" y="3" width="3" height="9" rx="1" />
                    <rect x="15" y="0" width="3" height="12" rx="1" />
                  </svg>
                  <svg viewBox="0 0 16 12" class="device-glyph" fill="currentColor">
                    <path d="M8 11.4 5.6 8.8a3.4 3.4 0 0 1 4.8 0L8 11.4Zm0-5.1a6 6 0 0 0-4.2 1.7L2.1 6.3a8.4 8.4 0 0 1 11.8 0l-1.7 1.7A6 6 0 0 0 8 6.3Zm0-4.2a10.2 10.2 0 0 0-7 2.8L-.7 3.2a12.6 12.6 0 0 1 17.4 0L15 4.9A10.2 10.2 0 0 0 8 2.1Z" />
                  </svg>
                  <svg viewBox="0 0 26 12" class="device-glyph device-glyph--battery" fill="none">
                    <rect x="0.5" y="0.5" width="21" height="11" rx="3.2" stroke="currentColor" stroke-opacity="0.45" />
                    <rect x="2" y="2" width="16" height="8" rx="2" fill="currentColor" />
                    <path d="M23 4.2c1.4.4 1.4 3.2 0 3.6V4.2Z" fill="currentColor" fill-opacity="0.45" />
                  </svg>
                </span>
              </div>
              <div class="device-urlbar">
                <svg viewBox="0 0 12 12" class="device-lock" fill="currentColor" aria-hidden="true">
                  <path d="M6 0a2.6 2.6 0 0 0-2.6 2.6V4H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1h-.4V2.6A2.6 2.6 0 0 0 6 0Zm1.4 4H4.6V2.6a1.4 1.4 0 1 1 2.8 0V4Z" />
                </svg>
                <span class="device-url">{props.url ?? "splitea.app"}</span>
              </div>
            </div>

            <div class="device-island" aria-hidden="true" />

            {/* The real product tree lives here. Everything above
                is browser furniture; nothing below this line is
                re-implemented UI. */}
            <div class="device-app">{props.children}</div>

            <div class="device-glare" aria-hidden="true" />
          </div>
        </div>
      </div>
    </div>
  );
}
