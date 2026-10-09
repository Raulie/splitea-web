const { landingPages } = await import(new URL("../../dist-ssr/entry-landing-ssr.js", import.meta.url));
console.log(
  JSON.stringify(
    landingPages.map((p) => ({
      code: p.code,
      seg: p.seg,
      lines: [p.hero.titleTop, p.hero.titleBottom],
      pills: p.hero.pills,
      tagline: p.meta.ogTagline,
    })),
  ),
);
