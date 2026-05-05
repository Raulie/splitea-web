/// SF Symbol `chevron.left` exported verbatim from Apple's
/// CoreSVG. Natural viewBox 10.6001 × 14.4185 (taller than
/// wide — the chevron's bounding box). `currentColor` lets
/// the parent's text-color class tint it.
///
/// Reused everywhere we need a chevron — back button (left,
/// no rotation), disclosure indicator (right, 180° rotation;
/// rotates further to "down" at 270° on expand), forward
/// disclosure indicator on list rows, etc. Single source of
/// truth so weight + visual style stay consistent across
/// every chevron in the app.
export interface ChevronGlyphProps {
  /// Rendered height in pixels. iOS uses `.body` (17pt) for
  /// nav-bar buttons and `.caption2` (~11pt) for inline
  /// disclosure indicators on list rows.
  size: number;
  /// Rotation in degrees. The natural orientation points LEFT.
  ///   • `0` (default) → ◀  (left, back-button direction)
  ///   • `90`          → ▼
  ///   • `180`         → ▶  (right, disclosure-collapsed)
  ///   • `270`         → ▲
  /// For animated rotations the caller usually applies the
  /// transform via inline style with a CSS transition rather
  /// than this prop, so the rotation interpolates instead of
  /// snapping.
  rotation?: number;
  class?: string;
}

export function ChevronGlyph(props: ChevronGlyphProps) {
  const ratio = 10.6001 / 14.4185;
  const width = () => props.size * ratio;
  return (
    <svg
      viewBox="0 0 10.6001 14.4185"
      width={width()}
      height={props.size}
      fill="currentColor"
      aria-hidden="true"
      class={props.class}
      style={
        props.rotation !== undefined && props.rotation !== 0
          ? { transform: `rotate(${props.rotation}deg)` }
          : undefined
      }
    >
      <path d="M0 7.20508C0 7.4126 0.074707 7.59521 0.232422 7.75293L6.81494 14.186C6.95605 14.3354 7.13867 14.4102 7.35449 14.4102C7.78613 14.4102 8.11816 14.0864 8.11816 13.6548C8.11816 13.439 8.02686 13.2563 7.89404 13.1152L1.85107 7.20508L7.89404 1.29492C8.02686 1.15381 8.11816 0.962891 8.11816 0.755371C8.11816 0.32373 7.78613 0 7.35449 0C7.13867 0 6.95605 0.074707 6.81494 0.21582L0.232422 6.65723C0.074707 6.80664 0 6.99756 0 7.20508Z" />
    </svg>
  );
}
