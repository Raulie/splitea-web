import { SpliteaMark } from "../components/SpliteaMark";
import { DeviceFrame } from "../components/DeviceFrame";
import { ItemsViewDemo } from "./ItemsView";
import { demoSnapshot } from "../lib/demoSnapshot";

const APP_STORE = "https://apps.apple.com/app/splitea/id6760237781";

export function Landing() {
  /// One fresh copy, created once per mount and never inside a
  /// reactive scope. `createSnapshotStore` hands this object
  /// straight to Solid's `createStore`, whose proxy writes
  /// THROUGH to it — mounting the module const would let a
  /// visitor's taps permanently mutate the fixture, and creating
  /// it inside a memo would reset every claim mid-demo.
  const snapshot = demoSnapshot();

  return (
    <main class="page-scroll bg-black text-white antialiased">
      <header class="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <div class="flex items-center gap-2.5">
          <SpliteaMark class="h-6 w-auto text-white" />
          <span class="text-[15px] font-semibold tracking-tight">Splitea</span>
        </div>
        <a
          href={APP_STORE}
          class="rounded-full border border-white/15 px-4 py-1.5 text-[13px] font-medium text-white/80 no-underline transition hover:border-white/35 hover:text-white"
        >
          App Store
        </a>
      </header>

      <section class="mx-auto grid max-w-5xl items-center gap-12 px-6 pb-24 pt-8 lg:grid-cols-[1fr_auto] lg:gap-16 lg:pt-16">
        <div class="min-w-0 max-w-md">
          <h1 class="text-balance text-[2.6rem] font-semibold leading-[1.05] tracking-[-0.03em] sm:text-[3.2rem]">
            Split the bill without the group chat.
          </h1>
          <p class="mt-6 text-[1.0625rem] leading-relaxed text-white/60">
            Scan the receipt, send a link. They tap what they had and
            the maths does itself. No app for them, no account.
          </p>

          <a
            href={APP_STORE}
            class="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-[15px] font-semibold text-black no-underline transition hover:bg-white/90"
          >
            Get Splitea
          </a>

          <p class="mt-10 border-l border-white/10 pl-4 text-[13px] leading-relaxed text-white/35">
            That phone is not a screenshot. It is the actual page
            your friends open, running right here. Pick a name,
            then tap what they had.
          </p>
        </div>

        {/* THE HERO. Not a drawing of the product: `ItemsViewDemo`
            is the exact component tree a `/r/<shareID>` visitor
            renders, driven by a fixture instead of a fetch, so
            this page cannot drift from what ships.

            `min-w-0`: a grid item defaults to `min-width: auto`,
            so without it the column can't shrink below the
            device's min-content and `.page-scroll`'s
            `overflow-x: hidden` would silently slice the phone's
            right edge off on narrow viewports. */}
        <div class="min-w-0 justify-self-center lg:justify-self-end">
          <DeviceFrame>
            <ItemsViewDemo snapshot={snapshot} />
          </DeviceFrame>
        </div>
      </section>

      <section class="mx-auto max-w-5xl border-t border-white/10 px-6 py-14">
        <dl class="grid gap-10 sm:grid-cols-3">
          <div>
            <dt class="text-[15px] font-semibold">They don't need the app</dt>
            <dd class="mt-2 text-[14px] leading-relaxed text-white/50">
              A link opens in any browser. Your friends claim their
              items there, on Android, on a laptop, wherever.
            </dd>
          </div>
          <div>
            <dt class="text-[15px] font-semibold">Tax lands where it should</dt>
            <dd class="mt-2 text-[14px] leading-relaxed text-white/50">
              Per-item rates, local surcharges, service charges. The
              printed total is the total, to the cent.
            </dd>
          </div>
          <div>
            <dt class="text-[15px] font-semibold">Everyone edits at once</dt>
            <dd class="mt-2 text-[14px] leading-relaxed text-white/50">
              Changes show up live on everyone's screen while you're
              still at the table.
            </dd>
          </div>
        </dl>
      </section>

      <footer class="mx-auto flex max-w-5xl flex-col gap-4 border-t border-white/10 px-6 py-10 text-[13px] text-white/35 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex items-center gap-2">
          <SpliteaMark class="h-4 w-auto text-white/35" />
          <span>Splitea · Made in Puerto Rico</span>
        </div>
        {/* `rel="external"` is the @solidjs/router opt-out. Without
            it the Router intercepts these same-origin clicks, pushStates
            without issuing a request, and falls through to the `*` route
            (NotFound) — `/legal/*` is owned by the separate splitea-legal
            worker, so it needs a real browser navigation to be reached.
            Same reasoning as the `/p/*` anchors in PayMenuSheet. */}
        <div class="flex gap-5">
          <a class="text-white/35 no-underline hover:text-white/70" rel="external" href="/legal/privacy">
            Privacy
          </a>
          <a class="text-white/35 no-underline hover:text-white/70" rel="external" href="/legal/terms">
            Terms
          </a>
          <a class="text-white/35 no-underline hover:text-white/70" href={APP_STORE}>
            App Store
          </a>
        </div>
      </footer>
    </main>
  );
}
