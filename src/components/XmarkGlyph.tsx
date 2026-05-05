/// SF Symbol `xmark` exported verbatim from Apple's CoreSVG.
/// Natural viewBox 13.5365 × 13.1713 — close to square (the
/// "X" is symmetric but the bounding box has tiny asymmetry
/// from the rounded stroke caps). `currentColor` lets the
/// parent's text color tint it.
///
/// Used by `CloseButton` and any other dismiss-style
/// affordance (action-sheet close, modal dismiss, etc.).
export interface XmarkGlyphProps {
  /// Rendered height in pixels. iOS toolbar dismiss buttons
  /// render this at `.body` font size (~17pt) to visually
  /// match adjacent icon buttons like back chevrons.
  size: number;
  class?: string;
}

export function XmarkGlyph(props: XmarkGlyphProps) {
  const ratio = 13.5365 / 13.1713;
  const width = () => props.size * ratio;
  return (
    <svg
      viewBox="0 0 13.5365 13.1713"
      width={width()}
      height={props.size}
      fill="currentColor"
      aria-hidden="true"
      class={props.class}
    >
      <path d="M0.214794 12.9565C0.505321 13.2387 0.986767 13.2387 1.26899 12.9565L6.58149 7.64399L11.894 12.9565C12.1762 13.2387 12.666 13.247 12.9482 12.9565C13.2304 12.666 13.2304 12.1928 12.9482 11.9106L7.63569 6.58979L12.9482 1.27729C13.2304 0.995067 13.2387 0.513622 12.9482 0.231396C12.6577-0.0591318 12.1762-0.0591318 11.894 0.231396L6.58149 5.5439L1.26899 0.231396C0.986767-0.0591318 0.497021-0.0674326 0.214794 0.231396C-0.0674326 0.521923-0.0674326 0.995067 0.214794 1.27729L5.52729 6.58979L0.214794 11.9106C-0.0674326 12.1928-0.0757334 12.6743 0.214794 12.9565Z" />
    </svg>
  );
}
