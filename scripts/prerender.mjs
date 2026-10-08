import { readFile, writeFile } from "node:fs/promises";

const dist = new URL("../dist/", import.meta.url);
const { renderLanding } = await import(new URL("../dist-ssr/entry-landing-ssr.js", import.meta.url));

const shell = await readFile(new URL("index.html", dist), "utf8");
const root = '<div id="root"></div>';
if (!shell.includes(root)) throw new Error("index.html has no empty #root to prerender into");

const notFound = shell.replace("<head>", '<head>\n    <meta name="robots" content="noindex" />');
await writeFile(new URL("404.html", dist), notFound);

const html = renderLanding();
if (!html.includes("lp-h1")) throw new Error("prerendered landing is missing its headline");
await writeFile(new URL("index.html", dist), shell.replace(root, `<div id="root" data-prerender="landing">${html}</div>`));

console.log(`prerendered / (${(html.length / 1024).toFixed(1)} KB) and wrote 404.html`);
