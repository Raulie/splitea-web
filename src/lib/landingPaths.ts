export const LANDING_SEGMENTS = ["es", "pt-br", "fr", "de", "it", "ja", "ko", "zh-hans", "zh-hant"];

export function landingSegment(pathname: string): string | null | undefined {
  if (pathname === "/") return null;
  const m = /^\/([a-z-]+)\/?$/i.exec(pathname);
  const seg = m?.[1].toLowerCase();
  return seg && LANDING_SEGMENTS.includes(seg) ? seg : undefined;
}
