/// SF Symbol `checkmark` exported verbatim from Apple's
/// CoreSVG (`Generator: Apple Native CoreSVG 326`). Natural
/// viewBox 15.0433 × 14.7973 — width is derived from the
/// natural aspect ratio so the tick isn't stretched at any
/// caller-passed height. `currentColor` lets the parent tint
/// via `text-…` Tailwind classes or an inline `style.color`.
///
/// Apple's export uses `fill="white" fill-opacity="0.85"` to
/// emulate the secondary-label rendering on a dark canvas;
/// we drop that and use full-opacity `currentColor` because
/// our callers pick the tint explicitly (system-green on the
/// connected pill, etc.) and don't want the secondary-style
/// dim baked in.
export function CheckmarkGlyph(props: { size: number }) {
  const width = () => (props.size * 15.0433) / 14.7973;
  return (
    <svg
      viewBox="0 0 15.0433 14.7973"
      width={width()}
      height={props.size}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M5.61381 14.7973C6.04545 14.7973 6.38594 14.6172 6.62251 14.2563L14.4249 2.09295C14.5997 1.81936 14.6698 1.59042 14.6698 1.36514C14.6698 0.793553 14.2679 0.399104 13.6903 0.399104C13.2806 0.399104 13.0427 0.536896 12.7942 0.92703L5.58061 12.3871L1.86335 7.6075C1.62146 7.28709 1.36763 7.15296 1.00903 7.15296C0.416363 7.15296 0 7.56782 0 8.14091C0 8.3871 0.0919723 8.63579 0.298992 8.88731L4.59963 14.268C4.886 14.6261 5.19562 14.7973 5.61381 14.7973Z" />
    </svg>
  );
}
