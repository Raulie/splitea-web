/// SF Symbol `square.and.arrow.down` exported verbatim from
/// Apple's CoreSVG (`Generator: Apple Native CoreSVG 326`).
/// Two sub-paths: the U-shaped tray (a square with the top
/// edge open) and the vertical arrow shaft + chevron head
/// pointing down into it. Natural viewBox 15.3749 × 21.0242
/// — width is derived from the natural aspect ratio so the
/// glyph isn't stretched at any caller-passed height.
///
/// `currentColor` tints both sub-paths together so the parent
/// (e.g. `DownloadButton` wrapping it in `text-ios-label`)
/// sets the whole glyph in one go. Apple's export uses
/// `fill="white" fill-opacity="0.85"` to emulate secondary-
/// label rendering on a dark canvas; we drop that since
/// callers pick the tint explicitly and don't want the
/// secondary-style dim baked in.
export function DownloadGlyph(props: { size: number }) {
  const width = () => (props.size * 15.3749) / 21.0242;
  return (
    <svg
      viewBox="0 0 15.3749 21.0242"
      width={width()}
      height={props.size}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M15.0013 8.77558L15.0013 16.9072C15.0013 18.6784 14.07 19.603 12.2783 19.603L2.72298 19.603C0.931345 19.603 0 18.6852 0 16.9072L0 8.77558C0 6.99606 0.938152 6.07982 2.72298 6.07982L5.16591 6.07982L5.16591 7.7061L2.82408 7.7061C2.05227 7.7061 1.62628 8.10421 1.62628 8.91071L1.62628 16.7706C1.62628 17.5786 2.04547 17.9767 2.81728 17.9767L12.1772 17.9767C12.9422 17.9767 13.375 17.5786 13.375 16.7706L13.375 8.91071C13.375 8.10421 12.9422 7.7061 12.1772 7.7061L9.82861 7.7061L9.82861 6.07982L12.2783 6.07982C14.07 6.07982 15.0013 7.00287 15.0013 8.77558Z" />
      <path d="M7.50407 1.6414C7.08289 1.6414 6.73243 1.98571 6.73243 2.39112L6.73243 10.7225L6.79419 11.9586L6.35773 11.4315L5.16823 10.1665C5.03558 10.0172 4.84333 9.93886 4.64893 9.93886C4.26892 9.93886 3.9691 10.211 3.9691 10.5991C3.9691 10.8041 4.05128 10.9534 4.18924 11.0913L6.92252 13.722C7.11991 13.9164 7.29837 13.9797 7.50407 13.9797C7.70295 13.9797 7.88291 13.9164 8.07881 13.722L10.8121 11.0913C10.9515 10.9534 11.0322 10.8041 11.0322 10.5991C11.0322 10.211 10.7188 9.93886 10.3456 9.93886C10.1512 9.93886 9.96575 10.0172 9.8331 10.1665L8.6436 11.4315L8.20714 11.9586L8.2689 10.7225L8.2689 2.39112C8.2689 1.98571 7.92525 1.6414 7.50407 1.6414Z" />
    </svg>
  );
}
