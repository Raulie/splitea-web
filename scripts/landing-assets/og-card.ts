import { execFileSync, spawn } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DEMO_SNAPSHOT } from "../../src/lib/demoSnapshot";
import { LANDING_LOCALES, loadCopy } from "../../src/views/landing/locales";

const ROOT = process.argv[2] ?? process.cwd();
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const work = mkdtempSync(path.join(process.env.OG_WORK ?? tmpdir(), "og-card-"));
for (const f of ["bricolage-800-wdth-latin-v1.woff2", "jetbrains-mono-800-latin-v1.woff2"]) {
  copyFileSync(path.join(ROOT, "public/fonts", f), path.join(work, f));
}
const markPaths = [...readFileSync(path.join(ROOT, "scripts/landing-assets/mark.svg"), "utf8").matchAll(/ d="([^"]+)"/g)].map((m) => m[1]);
const mark = (fill: string) => `<svg viewBox="0 0 400 672">${markPaths.map((d) => `<path d="${d}" fill="${fill}"/>`).join("")}</svg>`;

const CJK: Record<string, string> = {
  ja: '"Hiragino Sans"',
  ko: '"Apple SD Gothic Neo"',
  "zh-Hans": '"PingFang SC"',
  "zh-Hant": '"PingFang TC"',
};
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const accent = (s: string, cjk: boolean) =>
  esc(s)
    .replace(/\n/g, cjk ? "" : " ")
    .replace(/\[\[([^\]]+)\]\]/g, "<em>$1</em>");

const items = DEMO_SNAPSHOT.items;
const cents = (n: number) => Math.round(n * 100) / 100;
const subtotal = cents(items.reduce((s, i) => s + i.price, 0));
const tax = cents(items.reduce((s, i) => s + (i.taxAmount ?? 0), 0));
const tip = cents(subtotal * (DEMO_SNAPSHOT.receipt.tipValue / 100));
const total = cents(subtotal + tax + tip);

for (const locale of LANDING_LOCALES) {
  const copy = await loadCopy(locale.code);
  const cjk = locale.code in CJK;
  const nl = locale.code === "es" ? "es-MX" : locale.code;
  const num = new Intl.NumberFormat(nl, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format;
  const pct = new Intl.NumberFormat(nl, { style: "percent", maximumFractionDigits: 1 }).format(DEMO_SNAPSHOT.receipt.tipValue / 100);
  const r = copy.v2.hero.receipt;
  const fallback = CJK[locale.code] ? `, ${CJK[locale.code]}` : "";
  const row = (a: string, b: string, cls = "") => `<div class="row ${cls}"><span>${esc(a)}</span><span>${b}</span></div>`;
  const html = `<!doctype html><html lang="${locale.code}"><meta charset="utf-8"><style>
@font-face{font-family:B;src:url(bricolage-800-wdth-latin-v1.woff2) format("woff2");font-weight:800;font-stretch:75% 100%}
@font-face{font-family:J;src:url(jetbrains-mono-800-latin-v1.woff2) format("woff2");font-weight:800}
*{box-sizing:border-box}html,body{margin:0;width:1200px;height:630px;overflow:hidden}
.card{position:relative;width:1200px;height:630px;overflow:hidden;background:#efe7d6;color:#1a1614}
.brand{position:absolute;left:72px;top:58px;display:flex;align-items:center;gap:12px;font:800 34px/1 B${fallback};font-variation-settings:"wdth" 90}
.brand svg{height:40px;width:auto}
.text{position:absolute;left:68px;top:112px;width:580px;height:416px;display:flex;flex-direction:column;justify-content:center}
.giant{font:800 196px/${cjk ? "1.04" : ".82"} B${fallback};font-stretch:75%;font-variation-settings:"wdth" 75;text-transform:uppercase;letter-spacing:${cjk ? "0" : "-.01em"};white-space:nowrap}
.kicker{margin-top:24px;font:800 76px/1.05 B${fallback};font-variation-settings:"wdth" 92;white-space:nowrap}
.kicker em{font-style:normal;color:#a8452f}
.bl{display:inline-block;width:0;height:0;vertical-align:baseline}
.foot{position:absolute;left:74px;bottom:54px;color:#6b665d;font:800 17px/1 J${fallback};letter-spacing:${cjk ? ".04em" : ".14em"};text-transform:uppercase}
.mark{position:absolute;right:62px;top:28px;height:574px}
.mark svg{height:100%;width:auto}
.rcw{position:absolute;right:146px;top:50%;transform:translateY(-50%)}
.stw{position:absolute;left:0;right:0;bottom:34px}
.drop{rotate:-4deg;filter:drop-shadow(0 26px 34px rgb(26 22 20/.28)) drop-shadow(0 3px 4px rgb(26 22 20/.2))}
.receipt{width:300px;padding:22px 18px 26px;background:#fff;font:500 14px/1.5 ui-monospace,"SF Mono",Menlo${fallback},monospace;
-webkit-mask:conic-gradient(from -45deg at bottom,#0000,#000 1deg 89deg,#0000 90deg) bottom/12px 51% repeat-x,conic-gradient(from 135deg at top,#0000,#000 1deg 89deg,#0000 90deg) top/12px 51% repeat-x}
.rh{font:800 19px/1.1 J${fallback};letter-spacing:.06em;text-align:center}
.rs{font-size:12px;text-align:center;text-transform:uppercase;color:#6b665d;margin:4px 0 12px}
.row{display:flex;justify-content:space-between;gap:10px}.tot{font-weight:800;font-size:16px;text-transform:uppercase;margin-top:2px}
hr{border:0;border-top:1.5px dashed #b9b2a6;margin:8px 0}
.thanks{margin-top:12px;font-size:12px;letter-spacing:.2em;text-align:center;text-transform:uppercase;color:#6b665d}
.stamp{position:absolute;bottom:0;rotate:-3deg;display:inline-block;white-space:nowrap;padding:12px 20px 11px;border:3px solid #1a1614;border-radius:10px;background:#fff;box-shadow:5px 5px 0 #1a1614;font:800 32px/1.12 J${fallback};letter-spacing:.03em;text-transform:uppercase;text-align:center}
</style><div class="card">
<div class="brand">${mark("#1a1614")}Splitea</div>
<div class="text"><div class="giant"><span>${copy.v2.hero.giant.map((l) => `<i class="bl"></i>${esc(l)}`).join("<br>")}</span></div><div class="kicker"><span><i class="bl"></i>${accent(copy.hero.titleBottom, cjk)}</span></div></div>
<div class="foot">${esc(copy.meta.ogTagline)}</div>
<div class="mark">${mark("#c8553d")}</div>
<div class="rcw"><div class="drop"><div class="receipt">
<div class="rh">${esc(DEMO_SNAPSHOT.receipt.merchantName!.toUpperCase())}</div><div class="rs">${esc(r.place)}</div>
${items.map((i) => row(i.itemDescription, num(i.price))).join("")}<hr>
${row(r.subtotal, num(subtotal))}${row(r.tax, num(tax))}${row(`${r.tip} (${pct})`, num(tip))}${row(r.total, num(total), "tot")}
<div class="thanks">${esc(r.thanks)}</div></div></div></div>
<div class="stw"><span class="stamp">${esc(copy.meta.ogStamp)}</span></div>
</div><script>
const size = (el) => parseFloat(getComputedStyle(el).fontSize);
const fit = (el, w) => { const inner = el.firstElementChild ?? el; while (inner.getBoundingClientRect().width > w && size(el) > 12) el.style.fontSize = size(el) - 2 + "px"; };
document.fonts.ready.then(() => {
  const g = document.querySelector(".giant"), k = document.querySelector(".kicker"), st = document.querySelector(".stamp");
  fit(g, 570); fit(k, 560);
  const ctx = document.createElement("canvas").getContext("2d");
  const ink = (el, stretch, text) => { const cs = getComputedStyle(el); ctx.font = cs.fontWeight + " " + cs.fontSize + " " + cs.fontFamily; ctx.fontStretch = stretch; const m = ctx.measureText(text); return [m.actualBoundingBoxAscent, m.actualBoundingBoxDescent]; };
  const bare = (t) => t.replace(/[,.。、]/g, "");
  const base = (el) => el.getBoundingClientRect().top;
  const margin = () => parseFloat(getComputedStyle(k).marginTop);
  const space = () => {
    const [m1, m2] = g.querySelectorAll(".bl"), mk = k.querySelector(".bl"), [l1, l2] = g.innerText.split("\\n");
    const d1 = ink(g, "condensed", bare(l1))[1], [u2, d2] = ink(g, "condensed", bare(l2)), dp = ink(g, "condensed", l2)[1], uk = ink(k, "semi-condensed", bare(k.innerText))[0];
    const gap = base(m2) - u2 - base(m1) - d1, letters = base(mk) - uk - base(m2) - d2;
    k.style.marginTop = margin() + Math.max(gap - letters, gap * 0.6 - (letters - (dp - d2))) + "px";
  };
  for (let i = 0; i < 80; i++) { space(); if (g.offsetHeight + k.offsetHeight + margin() <= 416 || size(g) <= 40) break; g.style.fontSize = size(g) - 2 + "px"; }
  while (st.offsetWidth > 620 && size(st) > 16) st.style.fontSize = size(st) - 1 + "px";
  const rcw = document.querySelector(".rcw"), r0 = document.querySelector(".drop").getBoundingClientRect();
  const k0 = Math.min(0.84, (st.getBoundingClientRect().top - 24 - 315) / (r0.height / 2));
  rcw.style.transform = "translateY(-50%) scale(" + k0 + ")";
  const rb = rcw.getBoundingClientRect();
  st.style.left = Math.min((rb.left + rb.right) / 2 - st.offsetWidth / 2, 1160 - st.offsetWidth) + "px";
});
</script></html>`;
  const seg = locale.seg || "en";
  const htmlPath = path.join(work, `${seg}.html`);
  const shot = path.join(work, `${seg}@2x.png`);
  writeFileSync(htmlPath, html);
  const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars", `--user-data-dir=${path.join(work, `prof-${seg}`)}`, "--force-device-scale-factor=2", "--window-size=1200,630", "--virtual-time-budget=3000", `--screenshot=${shot}`, `file://${htmlPath}`], { stdio: "ignore" });
  for (let i = 0; i < 300 && !(existsSync(shot) && statSync(shot).size > 0); i++) await sleep(200);
  await sleep(800);
  chrome.kill();
  if (!existsSync(shot)) throw new Error(`no screenshot for ${seg}`);
  const out = path.join(ROOT, "public/og", `splitea-${seg}-v5-1200x630.png`);
  execFileSync("sips", ["-z", "630", "1200", shot, "--out", out], { stdio: "ignore" });
  console.log(`wrote ${path.relative(ROOT, out)}`);
}
