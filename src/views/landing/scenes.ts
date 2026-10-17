import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

type Opts = { total: number; owedShare: number; hasMenu: boolean; refit: () => void };

const STEP_COLORS = ["#D4816B", "#1A1614", "#EFE7D6", "#D4816B"];
const STEP_INK = ["#1A1614", "#EFE7D6", "#1A1614", "#1A1614"];
const SECTION_TINT: [string, string][] = [
  ["#top", "#EFE7D6"],
  ["#send", "#1A1614"],
  ["#try", "#EFE7D6"],
  ["#trips", "#D4816B"],
  ["#digital", "#1A1614"],
  ["#abroad", "#D4816B"],
  ["#privacy", "#1A1614"],
  ["#pricing", "#EFE7D6"],
  ["#faq", "#EFE7D6"],
  ["#last", "#1A1614"],
  ["#get", "#D4816B"],
];

function splitChars(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>(".lp-split").forEach((el) => {
    if (el.dataset.splitDone) return;
    el.dataset.splitDone = "1";
    const text = el.textContent ?? "";
    el.textContent = "";
    const frag = document.createDocumentFragment();
    for (const c of Array.from(text)) {
      const span = document.createElement("span");
      span.className = c === " " ? "lp-ch lp-sp" : "lp-ch";
      span.textContent = c === " " ? "\u00a0" : c;
      frag.append(span);
    }
    el.replaceChildren(frag);
  });
}

export function startScenes(root: HTMLElement, opts: Opts): () => void {
  const html = document.documentElement;
  const q = <T extends Element = HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const qa = <T extends Element = HTMLElement>(sel: string) => Array.from(root.querySelectorAll<T>(sel));
  const vh = () => document.documentElement.clientHeight;
  const vw = () => window.innerWidth;
  const fine = window.matchMedia("(pointer: fine)").matches;
  const tapeTweens: gsap.core.Tween[] = [];
  const disposers: (() => void)[] = [];
  const isPaused = () => html.classList.contains("lp-paused");
  let tint = () => undefined;
  let lastTime = 0;
  let card2Y = 0;

  splitChars(root);
  opts.refit();
  qa<HTMLImageElement>(".lp-step img, .lp-tphone img, .lp-fxphone img").forEach((img) => img.decode?.().catch(() => undefined));
  ScrollTrigger.config({ ignoreMobileResize: true });

  const ctx = gsap.context(() => {
    const placeFloods = () => {
      const w = vw();
      const h = Math.max(vh(), window.innerHeight) * 1.15;
      const d = 2 * Math.hypot(w, h);
      const corners = [
        [w, h],
        [w, h],
        [0, h],
        [w, h],
      ];
      qa(".lp-step .lp-flood").forEach((f, i) => {
        const [cx, cy] = corners[i];
        Object.assign(f.style, { width: `${d}px`, height: `${d}px`, left: `${cx - d / 2}px`, top: `${cy - d / 2}px` });
      });
      const how = q(".lp-how-stage");
      const verb = q(".lp-step .lp-verb");
      how.style.setProperty("--ph-top", `${verb.offsetTop + verb.offsetHeight + 12}px`);
      qa(".lp-step").forEach((s) => s.style.setProperty("--cap-h", `${s.querySelector<HTMLElement>(".lp-cap")!.offsetHeight}px`));
      const head = q(".lp-last-head");
      const ringH = q(".lp-ring").offsetHeight;
      const cardH = q(".lp-pcard-2").offsetHeight;
      const stage = q(".lp-last-stage");
      const bottom = Math.min(stage.offsetHeight, window.innerHeight) - 24;
      const ringTop = Math.max(0.3 * vh(), head.offsetTop + head.offsetHeight + 20);
      const cardsTop = bottom - cardH - 0.04 * vh();
      const ringK = Math.max(0.68, Math.min(1.45, (cardsTop - 0.06 * vh() - 16 - ringTop) / ringH));
      const cy = ringTop + 78 * ringK;
      const r = Math.hypot(w / 2, Math.max(cy, stage.offsetHeight - cy)) + 8;
      Object.assign(q(".lp-flood2").style, { width: `${2 * r}px`, height: `${2 * r}px`, marginLeft: `${-r}px`, marginTop: `${-r}px` });
      stage.style.setProperty("--ring-top", `${ringTop}px`);
      stage.style.setProperty("--ring-k", `${ringK}`);
      stage.style.setProperty("--cards-top", `${cardsTop}px`);
      card2Y = 0.04 * vh();
    };
    placeFloods();

    const heroIntro = () =>
      gsap
        .timeline({ paused: true })
        .from(".lp-hero .lp-giant .lp-ch", { yPercent: 130, duration: 0.6, ease: "back.out(1.6)", stagger: 0.03 }, 0)
        .from(".lp-kicker", { y: 20, opacity: 0, duration: 0.45, ease: "power3.out" }, 0.25)
        .from(".lp-rc-drop", { y: () => -0.6 * vh(), rotation: -24, duration: 0.8, ease: "back.out(1.2)" }, 0.15)
        .to(".lp-plate", { scaleY: 0.94, duration: 0.12, ease: "power2.out", transformOrigin: "50% 100%" }, 0.8)
        .to(".lp-plate", { scaleY: 1, duration: 0.35, ease: "back.out(3)" }, 0.92)
        .from(".lp-stage .lp-pi > *", { scale: 0, rotation: () => gsap.utils.random(-60, 60), duration: 0.7, ease: "back.out(1.7)", stagger: { each: 0.03, from: "center" } }, 0.55)
        .from(".lp-hero-stamp", { scale: 1.8, rotation: -14, opacity: 0, duration: 0.35, ease: "back.out(2.5)" }, 0.9)
        .from(".lp-hero-bottom", { opacity: 0, duration: 0.4 }, 0.3)
        .from(".lp-hero .lp-tk-track", { yPercent: 110, duration: 0.7, ease: "power4.out" }, 0.5);

    if (html.classList.contains("lp-booting")) {
      const intro = heroIntro();
      intro.progress(0).pause();
      const count = q(".lp-boot-count");
      const fmt = new Intl.NumberFormat(count.dataset.locale, { style: "currency", currency: "USD" });
      const boot = q(".lp-boot");
      const mark = q(".lp-boot-mark");
      let done = false;
      let raf = 0;
      let t0 = 0;
      const finish = () => {
        if (done) return;
        done = true;
        cancelAnimationFrame(raf);
        count.textContent = fmt.format(opts.total);
        try {
          sessionStorage.setItem("lp-intro", "1");
        } catch {
          void 0;
        }
        gsap.fromTo(boot, { clipPath: "inset(0 0 0% 0)" }, { clipPath: "inset(0 0 100% 0)", duration: 0.55, ease: "power3.inOut", onComplete: () => html.classList.remove("lp-booting") });
        gsap.delayedCall(0.12, () => intro.play());
      };
      const tick = (now: number) => {
        if (!t0) t0 = now;
        const p = Math.min(1, (now - t0) / 1150);
        count.textContent = fmt.format(opts.total * (1 - Math.pow(1 - p, 3)));
        if (p < 1) {
          raf = requestAnimationFrame(tick);
          return;
        }
        mark.classList.add("is-closed");
        gsap.to(".lp-boot-shares", { opacity: 1, duration: 0.2, delay: 0.35 });
        gsap.delayedCall(1.5, finish);
      };
      raf = requestAnimationFrame(tick);
      boot.addEventListener("pointerdown", finish, { once: true });
      window.addEventListener("keydown", finish, { once: true });
      gsap.delayedCall(4, finish);
    }

    {
      const hi = q(".lp-hero-in");
      const lead = () => Math.max(0, hi.offsetHeight - vh());
      const tl = gsap.timeline({
        scrollTrigger: { trigger: "#top", start: () => `top+=${lead()} top`, end: () => `top+=${lead() + 0.6 * vh()} top`, scrub: fine ? 0.9 : 0.6, invalidateOnRefresh: true },
        onUpdate: () => tint(),
      });
      tl.to(".lp-plate", { rotation: -12, ease: "none" }, 0)
        .to(".lp-rc-wrap", { y: () => -0.1 * vh(), rotation: -12, scale: 0.9, ease: "none" }, 0)
        .to(".lp-stage .lp-pt", { y: (_i: number, el: HTMLElement) => -(18 + 30 * parseFloat(el.dataset.depth ?? "1")) * vh() / 100, ease: "none" }, 0)
        .to(".lp-hero-head", { scale: 0.94, transformOrigin: "0% 0%", ease: "none" }, 0)
        .to(".lp-scrim", { opacity: 0.35, ease: "none" }, 0);
    }

    if (fine) {
      const items = qa(".lp-stage .lp-pt").map((el) => ({ d: parseFloat(el.dataset.depth ?? "1"), x: gsap.quickTo(el, "x", { duration: 0.8, ease: "power3" }) }));
      const tilt = gsap.quickTo(".lp-rc-drop", "rotationY", { duration: 0.8, ease: "power3" });
      const move = (e: PointerEvent) => {
        const nx = e.clientX / vw() - 0.5;
        items.forEach((it) => it.x(nx * 28 * it.d));
        tilt(nx * 6);
      };
      window.addEventListener("pointermove", move, { passive: true });
      disposers.push(() => window.removeEventListener("pointermove", move));
    }

    {
      const TOTAL = 6.2;
      const T0 = [0.6, 2.2, 3.8];
      const steps = qa(".lp-step");
      const dir = [0, 1, -1, 1];
      const rest = steps.map((s) => parseFloat(s.querySelector<HTMLElement>(".lp-phone")?.dataset.rest ?? "0"));
      steps.forEach((s, i) => {
        gsap.set(s.querySelector(".lp-verb"), { overflow: "clip" });
        gsap.set(s.querySelector(".lp-phone"), { rotation: rest[i] });
        if (i === 0) return;
        gsap.set(s.querySelector(".lp-flood"), { scale: 0 });
        gsap.set(s.querySelector(".lp-phone"), { x: () => dir[i] * 0.6 * vw(), y: () => 0.7 * vh(), rotation: rest[i] + dir[i] * 30 });
        gsap.set(s.querySelectorAll(".lp-vrow"), { yPercent: 110, xPercent: 30 });
        gsap.set(s.querySelectorAll(".lp-bub"), { scale: 0 });
        gsap.set(s.querySelector(".lp-cap"), { y: 40, opacity: 0 });
      });
      const payStep = steps[3];
      const scr2 = payStep.querySelector(".lp-scr2");
      gsap.set("#how", { backgroundColor: STEP_COLORS[0] });
      gsap.set(".lp-how-bar", { color: STEP_INK[0] });
      if (scr2) gsap.set(scr2, { opacity: 0 });
      const segs = qa(".lp-segs b");
      const bounds = [
        [0, 1.1],
        [1.1, 2.7],
        [2.7, 4.3],
        [4.3, TOTAL],
      ];
      const vid = q<HTMLVideoElement>(".lp-assign");
      let active = -1;
      const updateBar = (u: number) => {
        segs.forEach((b, i) => {
          const [a, z] = bounds[i];
          gsap.set(b, { scaleX: Math.max(0, Math.min(1, (u - a) / (z - a))) });
        });
        const idx = bounds.findIndex(([a, z]) => u >= a && u < z);
        const now = idx < 0 ? 3 : idx;
        if (now === active) return;
        active = now;
        if (now === 1 && !isPaused()) vid.play().catch(() => undefined);
        else vid.pause();
        vid.dataset.active = now === 1 ? "1" : "0";
      };
      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: { trigger: "#how", start: "top top", end: "bottom bottom", scrub: fine ? 0.9 : 0.6, invalidateOnRefresh: true, onUpdate: (self) => updateBar(self.progress * TOTAL) },
        onUpdate: () => tint(),
      });
      tl.set({}, {}, TOTAL);
      T0.forEach((t0, k) => {
        const out = steps[k];
        const inn = steps[k + 1];
        const i = k + 1;
        tl.to(out.querySelectorAll(".lp-bub"), { scale: 0, ease: "back.in(1.7)", duration: 0.25, stagger: 0.06 }, t0)
          .to(out.querySelectorAll(".lp-vrow"), { yPercent: -110, xPercent: -30, ease: "power3.in", duration: 0.35 }, t0 - 0.1)
          .to(out.querySelector(".lp-phone"), { x: () => -dir[i] * 0.55 * vw(), y: () => -0.75 * vh(), rotation: rest[k] - dir[i] * 26, ease: "power2.in", duration: 0.55 }, t0)
          .to(out.querySelector(".lp-cap"), { opacity: 0, y: -20, duration: 0.3 }, t0)
          .to(inn.querySelector(".lp-flood"), { scale: 1, duration: 0.5 }, t0 + 0.2)
          .set("#how", { backgroundColor: STEP_COLORS[i] }, t0 + 0.42)
          .set(".lp-how-bar", { color: STEP_INK[i] }, t0 + 0.42)
          .to(inn.querySelector(".lp-phone"), { x: 0, y: 0, rotation: rest[i], ease: "power3.out", duration: 0.4 }, t0 + 0.45)
          .to(inn.querySelectorAll(".lp-vrow"), { yPercent: 0, xPercent: 0, ease: "back.out(1.4)", duration: 0.3 }, t0 + 0.55)
          .to(inn.querySelector(".lp-cap"), { opacity: 1, y: 0, ease: "power3.out", duration: 0.3 }, t0 + 0.65)
          .to(inn.querySelectorAll(".lp-bub:not(.lp-later)"), { scale: 1, ease: "back.out(1.7)", duration: 0.2, stagger: 0.08 }, t0 + 0.8);
      });
      if (opts.hasMenu && scr2) {
        tl.to(payStep.querySelector(".lp-bub:not(.lp-later)"), { scale: 0, ease: "power2.in", duration: 0.15 }, 5.1)
          .to(scr2, { opacity: 1, ease: "power1.out", duration: 0.3 }, 5.3)
          .to(payStep.querySelector(".lp-bub.lp-later"), { scale: 1, ease: "back.out(1.7)", duration: 0.25 }, 5.5);
      }
      steps.forEach((s, i) => {
        const from = i === 0 ? 0 : T0[i - 1] + 0.55;
        const to = i === 3 ? TOTAL : T0[i] + 0.45;
        tl.fromTo(s.querySelector(".lp-verb .lp-giant"), { xPercent: 3 }, { xPercent: -3, duration: to - from }, from);
      });
      updateBar(0);
      qa<HTMLButtonElement>(".lp-segs button").forEach((b, i) =>
        b.addEventListener("click", () => {
          const st = tl.scrollTrigger!;
          const target = [0.3, 1.9, 3.5, 5.9][i] / TOTAL;
          window.scrollTo({ top: st.start + (st.end - st.start) * target, behavior: "smooth" });
        }),
      );
    }

    const drift = (el: HTMLElement, max: number) => Math.max(0, Math.min(max, (((vw() - el.offsetWidth) / 2 - 6) / el.offsetWidth) * 100));
    qa(".lp-chapter .lp-bigword > span").forEach((w) => {
      gsap.fromTo(w, { xPercent: () => drift(w, 10) }, { xPercent: () => -drift(w, 10), ease: "none", scrollTrigger: { trigger: w.closest(".lp-chapter"), start: "top bottom", end: "bottom top", scrub: true, invalidateOnRefresh: true } });
    });
    const restOf = (sel: string) => parseFloat(q(sel).dataset.rest ?? "0");
    const enter = (trigger: string) =>
      gsap.timeline({ defaults: { ease: "none" }, scrollTrigger: { trigger, start: "top bottom", end: "top 62%", scrub: 0.5, invalidateOnRefresh: true } });
    enter("#trips .lp-visual")
      .fromTo(".lp-tphone", { x: () => 0.35 * vw(), y: () => 0.2 * vh(), rotation: restOf(".lp-tphone") + 18 }, { x: 0, y: 0, rotation: restOf(".lp-tphone"), duration: 0.8, ease: "power2.out" })
      .fromTo("#trips .lp-bub", { scale: 0 }, { scale: 1, duration: 0.2, ease: "back.out(2)" }, 0.4)
      .fromTo("#trips .lp-seal", { scale: 0, rotation: -90 }, { scale: 1, rotation: 0, duration: 0.25, ease: "back.out(2)" }, 0.45);
    enter("#digital .lp-visual")
      .fromTo(".lp-sheet", { y: () => 0.2 * vh(), rotation: -6, opacity: 0 }, { y: 0, rotation: 0, opacity: 1, duration: 0.8, ease: "power2.out" })
      .fromTo(".lp-sheet-first", { scale: 0 }, { scale: 1, duration: 0.2, ease: "back.out(2)" }, 0.35)
      .fromTo(".lp-sheet-pb", { scale: 0 }, { scale: 1, duration: 0.2, ease: "back.out(2)" }, 0.45);

    qa(".lp-tape-track").forEach((t, i) => {
      tapeTweens.push(
        i === 0
          ? gsap.fromTo(t, { xPercent: 0 }, { xPercent: -50, duration: 40, ease: "none", repeat: -1 })
          : gsap.fromTo(t, { xPercent: -50 }, { xPercent: 0, duration: 40, ease: "none", repeat: -1 }),
      );
    });
    ScrollTrigger.create({
      trigger: "#abroad",
      start: "top bottom",
      end: "bottom top",
      onUpdate: (self) => {
        if (isPaused()) return;
        const v = gsap.utils.clamp(-4, 6, 1 + self.getVelocity() / 400);
        tapeTweens.forEach((t) => {
          t.timeScale(v);
          gsap.to(t, { timeScale: 1, duration: 0.9, ease: "power2.out", overwrite: true });
        });
      },
      onToggle: (self) => tapeTweens.forEach((t) => (self.isActive && !isPaused() ? t.play() : t.pause())),
    });
    qa(".lp-symbols > span").forEach((w) => {
      gsap.fromTo(w, { xPercent: () => drift(w, 12) }, { xPercent: () => -drift(w, 12), ease: "none", scrollTrigger: { trigger: "#abroad", start: "top bottom", end: "bottom top", scrub: true, invalidateOnRefresh: true } });
    });
    enter("#abroad .lp-visual")
      .fromTo(".lp-fxphone", { x: () => -0.35 * vw(), y: () => 0.2 * vh(), rotation: restOf(".lp-fxphone") - 20 }, { x: 0, y: 0, rotation: restOf(".lp-fxphone"), duration: 0.8, ease: "power2.out" })
      .fromTo("#abroad .lp-bub", { scale: 0 }, { scale: 1, duration: 0.2, ease: "back.out(2)" }, 0.4)
      .fromTo("#abroad .lp-seal", { scale: 0, rotation: -90 }, { scale: 1, rotation: 0, duration: 0.25, ease: "back.out(2)" }, 0.05);

    gsap
      .timeline({ scrollTrigger: { trigger: ".lp-long-wrap", start: "top 92%", end: "top 58%", scrub: true } })
      .fromTo(".lp-long", { clipPath: "inset(0 0 100% 0)" }, { clipPath: "inset(0 0 0% 0)", ease: "steps(16)" }, 0)
      .fromTo(".lp-long-wrap > .lp-rc-shadow", { y: -24 }, { y: 0, ease: "steps(16)" }, 0);
    gsap.from(".lp-check-stamp", { scale: 1.5, y: 20, rotation: -12, opacity: 0, duration: 0.45, ease: "back.out(2.2)", scrollTrigger: { trigger: ".lp-long-wrap", start: "top bottom", once: true } });
    gsap.from(".lp-check-seal", { scale: 0, rotation: -90, duration: 0.5, delay: 0.1, ease: "back.out(2)", scrollTrigger: { trigger: ".lp-long-wrap", start: "top bottom", once: true } });

    {
      const arc = q(".lp-ring-arc");
      const st = q(".lp-ring-s");
      let last = -1;
      const setRing = (state: number) => {
        if (state === last) return;
        last = state;
        const target = state === 0 ? 0 : state === 1 ? opts.owedShare : 1;
        gsap.to(arc, { attr: { "stroke-dashoffset": 100 - target * 100 }, duration: 0.7, ease: "power3.out" });
        st.dataset.state = String(state);
      };
      setRing(0);
      const f2 = q(".lp-flood2");
      const ring = q(".lp-ring");
      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: "#last",
          start: "top top",
          end: () => `bottom top+=${q(".lp-last-stage").offsetHeight}`,
          scrub: 0.5,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            const u = self.progress * 3.4;
            setRing(u < 0.6 ? 0 : u < 1.3 ? 1 : 2);
          },
        },
        onUpdate: () => {
          lastTime = tl.time();
          tint();
        },
      });
      tl.set({}, {}, 3.4);
      tl.fromTo(".lp-pcard-1", { y: () => 1.2 * vh(), rotation: -10 }, { y: () => -0.06 * vh(), rotation: 3, ease: "back.out(.6)", duration: 0.9 }, 0)
        .fromTo(".lp-pcard-2", { y: () => 1.2 * vh(), rotation: 9 }, { y: () => card2Y, rotation: -3, ease: "back.out(.3)", duration: 0.9 }, 0.7)
        .to(".lp-pcard-1", { rotation: 1.5, y: () => -0.06 * vh(), duration: 0.3 }, 1.6)
        .to(".lp-pcard-2", { rotation: -1.5, y: () => card2Y, duration: 0.3 }, 1.6)
        .to(".lp-pcard-1 .lp-toast", { autoAlpha: 0, duration: 0.15 }, 1.45)
        .to(".lp-ring-flip", { rotationY: 180, ease: "back.inOut(1.4)", duration: 0.6 }, 2.2)
        .to(".lp-face2-back svg", { scale: 0.4, opacity: 0, duration: 0.1, ease: "power2.in" }, 2.8)
        .set(f2, { scale: () => ring.getBoundingClientRect().width / f2.offsetWidth }, 2.9)
        .to(f2, { scale: 1, duration: 0.4, ease: "power2.in" }, 2.9)
        .to("#last", { backgroundColor: "#D4816B", duration: 0.1 }, 3.2);
    }

    {
      gsap.set(".lp-paid .lp-ch", { yPercent: 130 });
      ScrollTrigger.create({
        trigger: "#get",
        start: "top 110%",
        once: true,
        onEnter: () => gsap.to(".lp-paid .lp-ch", { yPercent: 0, duration: 0.45, ease: "back.out(1.6)", stagger: 0.04 }),
      });
    }

    {
      const meta = document.querySelector('meta[name="theme-color"]');
      const cap = q(".lp-topcap");
      const scrim = q(".lp-scrim");
      const dim = (hex: string, k: number) => {
        const n = parseInt(hex.slice(1), 16);
        const ch = (shift: number, ink: number) => Math.round(((n >> shift) & 255) * (1 - k) + ink * k);
        return `rgb(${ch(16, 26)}, ${ch(8, 22)}, ${ch(0, 20)})`;
      };
      let shown = "";
      const set = (c: string, sel: string) => {
        if (shown === c + sel) return;
        shown = c + sel;
        meta?.setAttribute("content", c);
        cap.style.backgroundColor = c;
      };
      const tints = SECTION_TINT.flatMap(([sel, c]) => (sel === "#top" ? [[sel, c], ["#how", ""]] : [[sel, c]]))
        .map(([sel, c]) => ({ sel, c, el: q(sel) }))
        .reverse();
      tint = () => {
        const y = Math.max(cap.getBoundingClientRect().bottom, 1);
        const hit = tints.find(({ el }) => {
          const r = el.getBoundingClientRect();
          return r.top <= y && r.bottom > y;
        });
        if (!hit) return;
        set(
          hit.sel === "#how"
            ? getComputedStyle(hit.el).backgroundColor
            : hit.sel === "#top"
              ? dim(hit.c, Number(gsap.getProperty(scrim, "opacity")) || 0)
              : hit.sel === "#last" && lastTime >= 3.2
                ? "#D4816B"
                : hit.c,
          hit.sel,
        );
      };
      ScrollTrigger.create({ start: 0, end: "max", onUpdate: tint, onRefresh: tint });
      tint();
    }

    let rt = 0;
    let lastW = vw();
    const onResize = () => {
      window.clearTimeout(rt);
      rt = window.setTimeout(() => {
        if (vw() === lastW) {
          placeFloods();
          return;
        }
        lastW = vw();
        opts.refit();
        placeFloods();
        ScrollTrigger.refresh();
      }, 150);
    };
    window.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("resize", onResize);
    disposers.push(() => {
      window.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
    });
    let lastH = 0;
    let ht = 0;
    const ro = new ResizeObserver(() => {
      const h = root.offsetHeight;
      if (Math.abs(h - lastH) < 2) return;
      lastH = h;
      window.clearTimeout(ht);
      ht = window.setTimeout(() => {
        placeFloods();
        ScrollTrigger.refresh();
      }, 120);
    });
    ro.observe(root);
    disposers.push(() => ro.disconnect());
    document.fonts?.ready.then(() => {
      opts.refit();
      placeFloods();
      ScrollTrigger.refresh();
    });
  }, root);

  const applyPause = () => {
    const paused = isPaused();
    tapeTweens.forEach((t) => (paused ? t.pause() : t.play()));
    const vid = root.querySelector<HTMLVideoElement>(".lp-assign");
    if (vid) {
      if (paused) vid.pause();
      else if (vid.dataset.active === "1") vid.play().catch(() => undefined);
    }
  };
  applyPause();
  const mo = new MutationObserver(applyPause);
  mo.observe(html, { attributes: true, attributeFilter: ["class"] });
  html.classList.add("lp-gsap");
  ScrollTrigger.refresh();

  return () => {
    mo.disconnect();
    disposers.forEach((d) => d());
    ctx.revert();
    html.classList.remove("lp-gsap", "lp-booting");
  };
}
