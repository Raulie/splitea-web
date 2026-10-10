export type Spring = { duration: number; bounce: number };

const reducedMotionQuery =
  typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;

const running = new Set<SpringValue>();
let frame = 0;
let lastTime = 0;

export const prefersReducedMotion = () => !!reducedMotionQuery?.matches;

function tick(now: number) {
  const dt = Math.max(0, now - lastTime) / 1000;
  lastTime = now;
  try {
    for (const spring of [...running]) spring.advance(dt);
  } finally {
    frame = running.size > 0 ? requestAnimationFrame(tick) : 0;
  }
}

export class SpringValue {
  value: number;
  velocity = 0;
  target: number;
  private stiffness = 0;
  private damping = 0;
  private onRest?: () => void;
  private readonly onUpdate: (value: number) => void;
  private readonly epsilon: number;

  constructor(value: number, onUpdate: (value: number) => void, epsilon = 0.001) {
    this.value = value;
    this.target = value;
    this.onUpdate = onUpdate;
    this.epsilon = epsilon;
  }

  to(target: number, spring: Spring | null, onRest?: () => void) {
    this.target = target;
    this.onRest = onRest;
    if (!spring || prefersReducedMotion() || typeof requestAnimationFrame !== "function") {
      this.jump(target);
      return;
    }
    const omega = (2 * Math.PI) / spring.duration;
    this.stiffness = omega * omega;
    this.damping = 2 * (1 - spring.bounce) * omega;
    if (running.has(this)) return;
    running.add(this);
    if (!frame) {
      lastTime = performance.now();
      frame = requestAnimationFrame(tick);
    }
  }

  jump(value: number) {
    running.delete(this);
    this.value = value;
    this.target = value;
    this.velocity = 0;
    this.onUpdate(value);
    const done = this.onRest;
    this.onRest = undefined;
    done?.();
  }

  stop() {
    running.delete(this);
    this.onRest = undefined;
  }

  advance(dt: number) {
    if (dt > 0.5) {
      this.jump(this.target);
      return;
    }
    const omega = Math.sqrt(this.stiffness);
    const zeta = this.damping / (2 * omega);
    const x0 = this.value - this.target;
    const v0 = this.velocity;
    let x: number;
    let v: number;
    if (zeta < 1) {
      const omegaD = omega * Math.sqrt(1 - zeta * zeta);
      const decay = Math.exp(-zeta * omega * dt);
      const a = x0;
      const b = (v0 + zeta * omega * x0) / omegaD;
      const cos = Math.cos(omegaD * dt);
      const sin = Math.sin(omegaD * dt);
      x = decay * (a * cos + b * sin);
      v = decay * ((b * omegaD - zeta * omega * a) * cos - (a * omegaD + zeta * omega * b) * sin);
    } else {
      const decay = Math.exp(-omega * dt);
      const b = v0 + omega * x0;
      x = decay * (x0 + b * dt);
      v = decay * (b - omega * (x0 + b * dt));
    }
    this.value = this.target + x;
    this.velocity = v;
    if (Math.abs(this.value - this.target) < this.epsilon && Math.abs(this.velocity) < this.epsilon * 10) {
      this.jump(this.target);
      return;
    }
    this.onUpdate(this.value);
  }
}
