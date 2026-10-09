import { mkdir, readFile, writeFile } from "node:fs/promises";

const ORIGIN = "https://splitea.app";
const dist = new URL("../dist/", import.meta.url);
const { landingPages, renderLanding } = await import(new URL("../dist-ssr/entry-landing-ssr.js", import.meta.url));

const shell = await readFile(new URL("index.html", dist), "utf8");
const root = '<div id="root"></div>';
if (!shell.includes(root)) throw new Error("index.html has no empty #root to prerender into");

const notFound = shell.replace("<head>", '<head>\n    <meta name="robots" content="noindex" />');
await writeFile(new URL("404.html", dist), notFound);

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const setMeta = (html, attr, key, value) => {
  const re = new RegExp(`(<meta ${attr}="${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}" content=")[^"]*(")`);
  if (!re.test(html)) throw new Error(`missing <meta ${attr}="${key}">`);
  return html.replace(re, `$1${esc(value)}$2`);
};

const alternates = [
  ...landingPages.map((p) => `<link rel="alternate" hreflang="${p.hreflang}" href="${ORIGIN}${p.path}" />`),
  `<link rel="alternate" hreflang="x-default" href="${ORIGIN}/" />`,
].join("\n    ");

for (const page of landingPages) {
  const url = `${ORIGIN}${page.path}`;
  const image = `${ORIGIN}/og/splitea-${page.seg || "en"}-v1-1200x630.png`;
  let html = shell.replace(/<html lang="[^"]*">/, `<html lang="${page.code}">`);
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(page.meta.title)}</title>`);
  html = setMeta(html, "name", "description", page.meta.description);
  html = html.replace(
    /<link rel="canonical" href="[^"]*" \/>/,
    `<link rel="canonical" href="${url}" />\n    ${alternates}`,
  );
  html = setMeta(html, "property", "og:url", url);
  html = setMeta(html, "property", "og:locale", page.og);
  html = setMeta(html, "property", "og:title", page.meta.ogTitle);
  html = setMeta(html, "property", "og:description", page.meta.ogDescription);
  html = setMeta(html, "property", "og:image", image);
  html = setMeta(html, "property", "og:image:alt", page.meta.ogImageAlt);
  html = setMeta(html, "name", "twitter:title", page.meta.ogTitle);
  html = setMeta(html, "name", "twitter:description", page.meta.ogDescription);
  html = setMeta(html, "name", "twitter:image", image);

  const body = renderLanding(page.seg);
  if (!body.includes("lp-h1")) throw new Error(`prerendered ${page.path} is missing its headline`);
  html = html.replace(root, `<div id="root" data-prerender="landing" data-lang="${page.seg}">${body}</div>`);

  const dir = page.seg ? new URL(`${page.seg}/`, dist) : dist;
  await mkdir(dir, { recursive: true });
  await writeFile(new URL("index.html", dir), html);
  console.log(`prerendered ${page.path} (${(body.length / 1024).toFixed(1)} KB)`);
}

const links = landingPages
  .map((p) => `      <xhtml:link rel="alternate" hreflang="${p.hreflang}" href="${ORIGIN}${p.path}" />`)
  .concat(`      <xhtml:link rel="alternate" hreflang="x-default" href="${ORIGIN}/" />`)
  .join("\n");
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${landingPages.map((p) => `  <url>\n    <loc>${ORIGIN}${p.path}</loc>\n${links}\n  </url>`).join("\n")}
</urlset>
`;
await writeFile(new URL("sitemap.xml", dist), sitemap);
console.log(`wrote 404.html and sitemap.xml (${landingPages.length} pages)`);
