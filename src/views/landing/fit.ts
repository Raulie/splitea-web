export function fitGiants(root: HTMLElement) {
  const vh = document.documentElement.clientHeight;
  const vw = document.documentElement.clientWidth;
  root.querySelectorAll<HTMLElement>(".lp-fit").forEach((el) => {
    const lines = el.querySelectorAll<HTMLElement>(".lp-fl");
    el.style.fontSize = "100px";
    let max = 0;
    lines.forEach((l) => (max = Math.max(max, l.getBoundingClientRect().width)));
    const w = (el.parentElement ?? el).clientWidth;
    const cap = vh > 0 ? (parseFloat(el.dataset.cap ?? "15") / 100) * vh : Infinity;
    const lh = parseFloat(getComputedStyle(el).lineHeight) / 100 || 0.86;
    const give = vw < 900 && el.closest(".lp-hero") && document.documentElement.classList.contains("lp-suggesting") ? 52 / (lines.length * lh) : 0;
    if (max > 0) el.style.fontSize = `${Math.min(cap, ((100 * w) / max) * 0.985) - give}px`;
  });
  root.querySelectorAll<HTMLElement>(".lp-fitw").forEach((el) => {
    el.style.fontSize = "100px";
    const inner = (el.firstElementChild as HTMLElement | null) ?? el;
    const prev = inner.style.display;
    inner.style.display = "inline-block";
    const w0 = inner.getBoundingClientRect().width;
    inner.style.display = prev;
    const w = Math.min(vw, 1200) - 32;
    const cap = vh > 0 ? (parseFloat(el.dataset.cap ?? "20") / 100) * vh : Infinity;
    const factor = el.closest(".lp-verb") ? 0.9 : 0.97;
    if (w0 > 0) el.style.fontSize = `${Math.min(cap, ((100 * w) / w0) * factor)}px`;
  });
  const hi = root.querySelector<HTMLElement>(".lp-hero-in");
  if (hi) hi.style.top = `${Math.min(0, vh - hi.offsetHeight)}px`;
}
