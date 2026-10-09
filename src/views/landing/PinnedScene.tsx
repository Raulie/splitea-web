import { For, Show, createEffect, createMemo, createSignal, on, onCleanup, onMount } from "solid-js";
import { Accent, PhoneShot, Pill, ShotPicture, Tagline, type PillIcon, type Shot } from "./parts";
import { createPageVisible, createReducedMotion, observeOnce, smoothBehavior } from "./motion";
import { useLanding } from "./locales";

export type ScenePill = {
  n?: number;
  text: string;
  icon?: PillIcon;
  rate?: string;
  top: string;
  side: "left" | "right";
  late?: boolean;
};

export type SceneStep = {
  rail: string;
  title: string;
  body: string;
  tagline: string;
  screen: { shot: Shot } | { video: { hevc: string; h264: string; first: Shot; last: Shot; tapAt: number } };
  pills: ScenePill[];
};

export function PinnedScene(props: { steps: SceneStep[] }) {
  const { copy } = useLanding();
  const [step, setStep] = createSignal(0);
  const [armed, setArmed] = createSignal(false);
  const [playing, setPlaying] = createSignal(false);
  const [started, setStarted] = createSignal(false);
  const [failed, setFailed] = createSignal(false);
  const [userPaused, setUserPaused] = createSignal(false);
  const [lateShown, setLateShown] = createSignal(false);
  const reduced = createReducedMotion();
  const visible = createPageVisible();
  const triggers: HTMLDivElement[] = [];
  let scene!: HTMLDivElement;
  let video: HTMLVideoElement | undefined;

  const videoStep = () => props.steps.findIndex((s) => "video" in s.screen);
  const videoSpec = () => {
    const s = props.steps[videoStep()]?.screen;
    return s && "video" in s ? s.video : undefined;
  };
  const videoSrc = createMemo(() => {
    const v = videoSpec();
    if (!v || !armed()) return undefined;
    const probe = document.createElement("video");
    return probe.canPlayType('video/mp4; codecs="hvc1"') ? v.hevc : v.h264;
  });

  onMount(() => {
    const sync = () => {
      const d = triggers[0]?.offsetHeight || 1;
      const k = Math.floor(-scene.getBoundingClientRect().top / d);
      setStep(Math.max(0, Math.min(props.steps.length - 1, k)));
    };
    const io = new IntersectionObserver(sync, { rootMargin: "-49.5% 0px -49.5% 0px" });
    triggers.forEach((t) => io.observe(t));
    const sceneIO = new IntersectionObserver(sync);
    sceneIO.observe(scene);
    const disarm = observeOnce(scene, () => setArmed(true), "0px 0px 100% 0px");
    onCleanup(() => {
      io.disconnect();
      sceneIO.disconnect();
      disarm();
    });
  });

  const onVideoStep = () => step() === videoStep();
  const autoplayExpected = () =>
    onVideoStep() && !!videoSrc() && visible() && !reduced() && !userPaused() && !failed();

  const play = () => {
    if (!video) return;
    video.muted = true;
    video.play().catch((e: DOMException) => {
      if (e?.name !== "AbortError") setFailed(true);
    });
  };

  createEffect(
    on(onVideoStep, (now, prev) => {
      if (now && !prev) {
        setStarted(false);
        setLateShown(false);
        setFailed(false);
        if (video && video.currentTime > 0) video.currentTime = 0;
      }
      if (!now) setUserPaused(false);
    }),
  );

  createEffect(() => {
    const src = videoSrc();
    if (!video || !src) return;
    if (autoplayExpected()) {
      if (!video.ended) play();
    } else {
      video.pause();
    }
  });

  const toggleVideo = () => {
    if (!video) return;
    if (playing()) {
      setUserPaused(true);
      video.pause();
      return;
    }
    setUserPaused(false);
    setFailed(false);
    if (video.ended) video.currentTime = 0;
    play();
  };

  const onTime = () => {
    const v = videoSpec();
    if (v && video && video.currentTime >= v.tapAt) setLateShown(true);
  };

  const jump = (k: number) => {
    const t = triggers[k];
    if (!t) return;
    const top = scene.getBoundingClientRect().top + window.scrollY + k * t.offsetHeight + t.offsetHeight / 2;
    window.scrollTo({ top, behavior: smoothBehavior() });
  };

  const rel = (k: number) => (k < step() ? "before" : k === step() ? "active" : "after");
  const pillOn = (k: number, p: ScenePill) =>
    step() === k && (!p.late || lateShown() || !autoplayExpected());

  return (
    <div class="scene" ref={scene} data-step={step()} style={{ "--step": step() }}>
      <div class="scene-stage">
        <div class="scene-captions-col">
          <ol class="scene-caps">
            <For each={props.steps}>
              {(s, k) => (
                <li class="scene-cap" data-rel={rel(k())} aria-current={rel(k()) === "active" ? "step" : undefined}>
                  <h3 class="lp-h3">
                    <Accent text={s.title} />
                  </h3>
                  <Tagline text={s.tagline} class="scene-cap-tagline" />
                  <p class="scene-cap-body">{s.body}</p>
                </li>
              )}
            </For>
          </ol>
        </div>

        <div class="scene-phone-area">
          <div class="scene-phone">
            <PhoneShot pw="var(--scene-pw)">
              <For each={props.steps}>
                {(s, k) => (
                  <div class="scene-screen" classList={{ "is-active": step() === k() }} aria-hidden="true">
                    {"shot" in s.screen ? (
                      <ShotPicture shot={s.screen.shot} sizes="(min-width:1024px) 330px, 48vw" />
                    ) : (
                      <div class="scene-video" classList={{ "is-started": started() }}>
                        <ShotPicture
                          shot={reduced() || failed() ? s.screen.video.last : s.screen.video.first}
                          sizes="(min-width:1024px) 330px, 48vw"
                          height={1560}
                          width={720}
                        />
                        <video
                          ref={video}
                          muted
                          playsinline
                          preload="none"
                          disablepictureinpicture
                          disableremoteplayback
                          src={videoSrc()}
                          width={720}
                          height={1560}
                          onPlaying={() => {
                            setPlaying(true);
                            setStarted(true);
                          }}
                          onPause={() => setPlaying(false)}
                          onEnded={() => {
                            setPlaying(false);
                            setLateShown(true);
                          }}
                          onTimeUpdate={onTime}
                        />
                      </div>
                    )}
                  </div>
                )}
              </For>
            </PhoneShot>
            <div class="scene-pills" aria-hidden="true">
              <For each={props.steps}>
                {(s, k) => (
                  <For each={s.pills}>
                    {(p, i) => (
                      <Pill
                        n={p.n}
                        text={p.text}
                        icon={p.icon}
                        rate={p.rate}
                        class={`scene-pill scene-pill--${p.side}`}
                        style={{ top: p.top, "--d": `${(p.late ? 400 : 250 + i() * 150)}ms` }}
                        on={pillOn(k(), p)}
                      />
                    )}
                  </For>
                )}
              </For>
            </div>
            <Show when={videoStep() >= 0}>
              <button
                type="button"
                class="scene-video-toggle"
                classList={{ "is-shown": step() === videoStep() }}
                tabIndex={step() === videoStep() ? 0 : -1}
                aria-label={playing() ? copy.how.pause : copy.how.play}
                onClick={toggleVideo}
              >
                <Show
                  when={playing()}
                  fallback={
                    <svg viewBox="0 0 16 16" aria-hidden="true">
                      <path d="M5 3.2v9.6c0 .5.5.8 1 .5l7.4-4.8c.4-.3.4-.8 0-1.1L6 2.7c-.5-.3-1 0-1 .5Z" fill="currentColor" />
                    </svg>
                  }
                >
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <rect x="4" y="3" width="2.6" height="10" rx="1" fill="currentColor" />
                    <rect x="9.4" y="3" width="2.6" height="10" rx="1" fill="currentColor" />
                  </svg>
                </Show>
              </button>
            </Show>
          </div>
        </div>

        <div class="scene-segments">
          <For each={props.steps}>
            {(s, k) => (
              <button
                type="button"
                class="scene-seg"
                data-state={k() < step() ? "done" : k() === step() ? "active" : "todo"}
                aria-label={copy.how.stepGo(k() + 1, s.rail)}
                aria-current={k() === step() ? "step" : undefined}
                onClick={() => jump(k())}
              >
                <span class="scene-seg-track">
                  <span class="scene-seg-fill" />
                </span>
              </button>
            )}
          </For>
        </div>

        <div class="scene-rail">
          <span class="scene-rail-track" aria-hidden="true">
            <span class="scene-rail-fill" />
          </span>
          <ol class="scene-rail-labels">
            <For each={props.steps}>
              {(s, k) => (
                <li>
                  <button
                    type="button"
                    class="scene-rail-label"
                    classList={{ "is-active": k() === step() }}
                    aria-label={copy.how.stepGo(k() + 1, s.rail)}
                    aria-current={k() === step() ? "step" : undefined}
                    onClick={() => jump(k())}
                  >
                    {s.rail}
                  </button>
                </li>
              )}
            </For>
          </ol>
        </div>
      </div>

      <div class="scene-steps" aria-hidden="true">
        <For each={props.steps}>
          {(_, k) => <div class="scene-trigger" data-k={k()} ref={(el) => (triggers[k()] = el)} />}
        </For>
      </div>
    </div>
  );
}
