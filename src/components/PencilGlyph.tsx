/// SF Symbol `pencil` exported verbatim from Apple's CoreSVG
/// (`Generator: Apple Native CoreSVG 326`). Natural viewBox
/// 16.7776 × 16.4394 — caller passes the desired size; the
/// width/height are derived from the natural aspect ratio so
/// the glyph isn't stretched. `currentColor` lets the parent
/// tint via `text-…` Tailwind classes.
export function PencilGlyph(props: { size: number }) {
  // Use the size as the height; derive width from the
  // natural ratio (≈1.02:1). At small sizes the rounding
  // could produce 0 or negative widths if size is < 1, but
  // we never call it with values that small in practice.
  const width = () => (props.size * 16.7776) / 16.4394;
  return (
    <svg
      viewBox="0 0 16.7776 16.4394"
      width={width()}
      height={props.size}
      fill="currentColor"
      aria-hidden="true"
    >
      {/* Apple ships the symbol with a 0-opacity bounding rect
          at the top of the path list to lock the icon's hit
          area to the natural viewBox; we omit it because the
          surrounding <button> handles tap targets. */}
      <path d="M3.16348 15.5036L13.7221 4.92842L11.4892 2.69551L0.930565 13.2707L0.0340811 15.6696C-0.131935 16.1428 0.34121 16.5578 0.747948 16.4084ZM14.8095 3.84101L15.9799 2.67891C16.5277 2.13105 16.5526 1.46699 16.0214 0.92744L15.5067 0.404491C14.9755-0.13506 14.2948-0.0852549 13.7387 0.454296L12.5766 1.6081Z" />
    </svg>
  );
}
