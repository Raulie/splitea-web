/// SF Symbol `exclamationmark.triangle.fill` exported
/// verbatim from Apple's CoreSVG (`Generator: Apple Native
/// CoreSVG 326`). Two-color palette: yellow triangle (Apple
/// "systemYellow" = `#ffd60a`) and black exclamation mark.
/// Mirrors iOS's `.symbolRenderingMode(.palette)` +
/// `.foregroundStyle(.black, .yellow)` pair on the
/// `UnassignedItemsSection` header.
///
/// Natural viewBox 18.5854 × 16.9751 — height-driven; the
/// width is derived from the natural aspect ratio so the
/// glyph isn't stretched at any size.
export function WarningTriangleGlyph(props: { size: number }) {
  const width = () => (props.size * 18.5854) / 16.9751;
  return (
    <svg
      viewBox="0 0 18.5854 16.9751"
      width={width()}
      height={props.size}
      aria-hidden="true"
    >
      <path
        d="M2.77246 16.9751L15.4478 16.9751C17.0664 16.9751 18.2119 15.6553 18.2119 14.1943C18.2119 13.7378 18.104 13.2646 17.855 12.8247L11.5049 1.71826C10.9653 0.780273 10.0522 0.32373 9.11426 0.32373C8.16797 0.32373 7.22998 0.796875 6.70703 1.71826L0.356934 12.833C0.116211 13.2646 0 13.7378 0 14.1943C0 15.6553 1.14551 16.9751 2.77246 16.9751Z"
        fill="#ffd60a"
      />
      <path
        d="M9.12256 10.6499C8.38379 10.6499 7.94385 10.2432 7.89404 9.5127L7.73633 6.85645C7.68652 6.04297 8.25098 5.50342 9.11426 5.50342C9.97754 5.50342 10.542 6.04297 10.4922 6.85645L10.3345 9.49609C10.2847 10.2432 9.85303 10.6499 9.12256 10.6499ZM9.12256 13.8706C8.30078 13.8706 7.69482 13.4224 7.69482 12.6504C7.69482 11.8867 8.30078 11.4385 9.12256 11.4385C9.95264 11.4385 10.5337 11.895 10.5337 12.6504C10.5337 13.4224 9.94434 13.8706 9.12256 13.8706Z"
        fill="black"
      />
    </svg>
  );
}
