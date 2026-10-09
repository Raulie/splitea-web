# splitea-web: context for Claude

## Status

**LIVE.** Worker `splitea-web` serves `splitea.app/*`; `splitea-web-dev` serves `dev.splitea.app/*`. Two products share one build:

1. **The share page** friends open from a share link (`/r/<id>`). Real people use it mid-split, on links made by released iOS builds.
2. **The marketing landing** at `/`, `/es/`, `/pt-br/`, `/fr/`, `/de/`, `/it/`, `/ja/`, `/ko/`, `/zh-hans/`, `/zh-hant/`.

Solid 1.9, Vite 5, Tailwind 3, TypeScript, Cloudflare Workers static assets. **This GitHub repo is public:** architecture and workflow only. Never commit secrets, keys, account details or internal ops notes.

## Owner rules

- **Production deploys need Raúl's explicit go.** Deploy dev first, check it there, then ask.
- **Node 22:** `export PATH="/opt/homebrew/opt/node@22/bin:$PATH"`. Default node is 20; wrangler 4 refuses it. wrangler is not in package.json, `npx` fetches it.
- **Git:** commit only when asked. One-line messages, no body, no Co-Authored-By. Visual changes wait for Raúl to look before any commit or push.
- **No em dashes or en dashes** in any copy, any language. `grep -rnE $'\u2014|\u2013' src/views/landing src/locales index.html` (zsh) must print nothing. macOS `/usr/bin/grep` has no `-P`.
- **No explanatory comments** in new code; otherwise match the file you are in.
- **Claims must be true.** Privacy, pricing and feature copy must match the live policy (repo splitea-legal, served at `/legal/privacy`) and the code. Never "on-device", "free forever", "free trial", "no rounding", ratings, reviews or user counts. Policy changes deploy (splitea-legal) before landing copy that relies on them.
- **Localization:** every new user-facing string ships in all 10 languages, landing and share page alike.

## Live-user rules (from `/Users/raulie/Workspace/Splitea/CLAUDE.md`)

- The share page renders snapshots and live ops written by every released iOS build. `src/types/snapshot.ts` and `src/types/live.ts` mirror the Swift wire format: read new fields as optional, never require one an older build doesn't send.
- Wire changes follow the transition window: workers dual-accept first, the app ships second.
- Cross-repo order: splitea-shares before web when the page needs a new endpoint; web before an iOS release whose snapshots it must render; splitea-legal before privacy copy.
- Bill math (`src/lib/moneyMath.ts`, `settlement.ts`, `currencyConversion.ts`) stays at parity with iOS to the cent.

## Repo map

| Path | What |
|---|---|
| `src/index.tsx` | Boot. A prerendered landing is cleared and re-rendered (see Build) |
| `src/App.tsx` | Routes `/`, `/:lang` (filtered by `LANDING_SEGMENTS`), `/r/:shareID`, `/r/:shareID/c/:contactShortId`, `*` NotFound. Landing is `lazy()` |
| `src/views/ItemsView.tsx`, `SavedReceiptView.tsx`, `NotFound.tsx`, `src/components/` | Share page, all in `main.js`. `ItemsViewDemo` + `src/lib/demoSnapshot.ts` drive the landing hero demo. `DeviceFrame` is landing-only |
| `src/lib/` | `api.ts` (same-origin calls to splitea-shares), `socket.ts` (live relay), `payProviders.ts`, `i18n.ts`, `appStore.ts` (App Store links), `landingPaths.ts` (landing segments) |
| `src/locales/<code>.ts` | Share-page strings for `t()`; `en.ts` defines the keys |
| `src/views/landing/` | `Landing.tsx` (sections), `PinnedScene.tsx`, `LocalNav.tsx`, `DemoGate.tsx`, `parts.tsx`, `motion.ts`, `locales.ts`, `copy/<code>.ts`, `appStore.ts` (`PRICES`, `BEZEL_SRC`), `qr.ts` (generated), `landing.css` |
| `src/entry-landing-ssr.tsx` | SSR entry: registers the nine non-English copies (English is built in), exports `landingPages` and `renderLanding(seg)` |
| `scripts/prerender.mjs`, `scripts/gen-qr.mjs`, `scripts/landing-assets/` | Prerender; QR path for `qr.ts`; capture, encode, video, font and OG tools |
| `worker/index.js` | Byte-range handler for `/landing/*.mp4` |
| `public/` | `_headers`, `_redirects`, `robots.txt`, `landing/`, `badges/`, `og/`, `fonts/` |

## Share-page bundle contract (never break)

- splitea-shares renders the `/r/<id>` HTML itself and loads **`/assets/main.js` and `/assets/main.css` by fixed name** (`splitea-shares/src/index.ts`). `vite.config.ts` keeps `entryFileNames: "assets/main.js"` and maps only `index.css` to `assets/main.css`; everything else stays hashed.
- `_headers` sends `Access-Control-Allow-Origin: *` and `Cross-Origin-Resource-Policy: cross-origin` on `/assets/*`; without them Safari blocks a cross-origin module load and `#root` stays empty. Keep `main.*` on the short default cache, never immutable.
- `src/index.css` locks root scroll for the share page (the Android toolbar fixes). Only `html.landing` unlocks it, set by the inline script in `index.html` (its path regex must list every landing segment) and mirrored in `Landing` `onMount`.
- `ItemsView` is shared with the landing demo (`props.demo`, no network). Any ItemsView change needs a real `/r/` regression test: assign, Continue, Pay, Mark as paid.

**How the landing stays out of share pages:** lazy route in `App.tsx`; the `assetFileNames` rule above (landing CSS becomes `Landing-[hash].css`); the build-only `preloadLanding()` plugin in `vite.config.ts` links the landing chunk and its CSS from `index.html` only, which share pages never load; `tailwind.config.js` content excludes `./src/views/landing/**`; `landing.css` is plain CSS with no Tailwind.

## Build

`npm run build` runs, in order:
1. `tsc -b`
2. `vite build`: client to `dist/` (`main.js`, `main.css`, hashed chunks, `Landing-*.css`)
3. `vite build --config vite.ssr.config.ts`: SSR bundle to `dist-ssr/`, with `hydratable: false`
4. `node scripts/prerender.mjs`: `dist/index.html` and `dist/<seg>/index.html` with localized title, meta, OG, canonical and hreflang, plus the landing markup in `#root[data-prerender="landing"]`; `dist/404.html` (bare shell, `noindex`); `dist/sitemap.xml`. It throws if a page lacks `lp-h1`

No hydration: `index.tsx` sees the marker, awaits `preloadLanding(seg)`, then empties `#root` and renders synchronously. Server-unsafe code needs `isServer` guards (the live demo is client-only; `motion.ts` hooks return constants on the server). `dist/` and `dist-ssr/` are gitignored; build before every deploy. The prerender writes the sitemap, so there is no `public/sitemap.xml`.

**Check after every build:**
- `grep -cE '\.(lp-|scene-|phone-shot)' dist/assets/main.css` prints `0`
- `ls dist/assets/*.css` shows `main.css` and one `Landing-*.css`
- `dist/index.html` has the landing `modulepreload` and `Landing-*.css` link

## Landing i18n

- `copy/en.ts` is the source and defines `type Copy = typeof en`. Each `copy/<code>.ts` is `const xx: Copy`, so `tsc` catches a missing key but not an untranslated one. **Adding or changing a string means editing all 10 copy files.**
- Headline markup: `[[word]]` is the terracotta accent (one per headline; the closing period stays outside it, in ink); `\n` is a line break. `Accent` in `parts.tsx` renders it, and `og.py` reads the same markup.
- `locales.ts`: `LANDING_LOCALES` (code, seg, hreflang, og locale, name, suggest line, badge width), copy loaders, `LandingProvider`/`useLanding`, `localizedShot` (per-language screenshots), `badgeSrc` (per-language Apple badge in `public/badges/`).
- Paths: `src/lib/landingPaths.ts` owns `LANDING_SEGMENTS`; `src/lib/i18n.ts` gives a landing path's segment priority over browser languages (after `?lang=`). The share page picks its language from `?lang=`, then `navigator.languages`.
- `PRICES` are US prices; check them against the live US storefront when pricing copy changes.
- Adding a language touches: `locales.ts` (entry + loader), `copy/`, `entry-landing-ssr.tsx`, `landingPaths.ts`, the `index.html` inline regex, `src/locales/`, the language lists in `capture.sh` and `encode.sh`, a badge, an OG image and localized captures.

## Motion rules

- Scroll-driven effects are plain CSS in `landing.css`, only inside `@media (prefers-reduced-motion: no-preference) { @supports ((animation-timeline: view()) and (animation-range: entry)) { ... } }`.
- Write the `animation` shorthand first, then `animation-timeline`, then `animation-range` (the shorthand resets them).
- Entrances use `from` keyframes only, so content is complete without JS, in Firefox and under reduced motion.
- Pinned scene (`PinnedScene.tsx`): IntersectionObservers on the trigger divs and the scene set the step. No scroll listeners, no rAF loops. No timeline on the sticky `.scene-stage`, and no `overflow: hidden|auto|scroll` on its ancestors (use `clip`).
- `reveal` (`motion.ts`) flips `data-reveal` from `pending` to `done` once; it is a no-op under reduced motion.
- No transform, filter or opacity animation on the `DeviceFrame` subtree. `content-visibility` stays off the scene and anything with a view timeline.

## Assets

- `public/landing/<slug>[-<seg>]-v1-<width>.avif|webp`, the bezel, and the `assign-v1` HEVC/H.264 clips with first/last stills. `/landing/*`, `/fonts/*`, `/og/*`, `/badges/*` are cached a year, immutable: changed content needs a new `-vN` name (the font went to v2). `v1` is hardcoded in `ShotPicture`, `badgeSrc`, `BEZEL_SRC`, the video paths in `Landing.tsx`, `prerender.mjs`, `index.html` and the asset scripts.
- Captures: `scripts/landing-assets/capture.sh <sim-udid> <out-dir>` launches the Splitea Dev build (`com.raulie.Splitea.dev`) with the iOS screenshot-harness flags in all 10 languages, overrides the status bar to 9:41 and blurs the receipt header on the scan shot. Use a fresh simulator with no Apple Account signed in, or a password prompt covers the app.
- `encode.sh <captures-dir>` writes AVIF/WebP into `public/landing/`. `video.sh <OnboardingContacts.mp4> <9:41 capture>` makes the assign clips and stills. `font.sh <Bricolage variable ttf> <version>` subsets the headline font.
- OG images: after a build, `node scripts/landing-assets/og-pages.mjs | python3 scripts/landing-assets/og.py <captures-dir>` (needs Pillow and the TTF from `font.sh`).
- The scripts use ImageMagick (`magick`), `cwebp`, `ffmpeg` and fonttools (`pyftsubset`); `brico-800-96.ttf` and `mark.png` are gitignored and regenerated.
- After re-shooting, re-measure the pill `top` percentages in `buildSteps` (`Landing.tsx`). They are percentages of the screen (`.scene-pills` sits exactly on `.phone-shot-screen`), centered on the row they point at. On the Taxes screen, languages whose subtitle wraps to two lines (es, pt-br, fr, de, it) push every row down 2.3%, which is what `TAX_ROWS` encodes; detect row dividers in each capture rather than eyeballing. A re-cut assign clip also needs its `tapAt` (seconds into the clip when the `late` pill appears).

## Worker, routing, headers

- `worker/index.js` runs only for `/landing/*.mp4` (`run_worker_first`) and answers byte-range requests with `206`, which Safari needs before it plays an MP4. Every other path is served straight from the assets.
- `not_found_handling = "404-page"`: unknown paths return `dist/404.html` with a real 404, and the router shows NotFound.
- `public/_redirects`: `/get` 302s to the App Store with `ct=qr`. The landing QR (`scripts/gen-qr.mjs` writes `qr.ts`) encodes `https://splitea.app/get`; keep that path.
- Other workers own paths on the same host: splitea-shares (`/r/*`, `/p/*`, `/live/*`, `/.well-known/*`, the favicons and `apple-touch-icon.png`), splitea-id (`/id/*`), splitea-legal (`/legal/*`). Links to them, and between language pages, use `rel="external"` so the Solid router does a full load.
- Cloudflare Web Analytics is injected by Cloudflare, not this repo, and is disclosed in the policy and the landing privacy copy.

## App Store links

- Always `appStoreUrl(campaign)` from `src/lib/appStore.ts` (`APP_ID`, `PT`). Campaigns: `landing` (every landing CTA and the Smart App Banner in `index.html`), `qr` (`/get`), `share` (NotFound, the expired-link state, and splitea-shares' own links and banner). `index.html` and `public/_redirects` hardcode the same IDs; keep them in sync.
- Apple hides campaign data below 5 installs, so do not split these further.
- Never link to the unrelated "Splitea - Split Bills" app.

## Local testing

- `npm run dev`: Vite on :5173. `vite.config.ts` has no proxy, so `/r/<id>` has no backend here. `.claude/launch.json` here (gitignored) and in the Splitea repo define `splitea-web` (`npm run dev -- --host`, port 5173).
- Production-like, on Node 22: `npm run build && npx wrangler dev --local` serves `dist/` through the worker (prerender, 404, `/get`, Range).
- Share-page changes: test a real link on `dev.splitea.app/r/<id>` after a dev deploy.

## Deploy

```
cd /Users/raulie/Workspace/splitea-web
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
npm run build
npx wrangler deploy --env dev   # dev.splitea.app
npx wrangler deploy             # splitea.app, only on Raúl's go
```

Verify on each host (`dev.splitea.app` for dev):
- `curl -s -A Googlebot https://splitea.app/ja/ | grep -o '<h1 class="lp-h1">[^<]*'` shows the start of the prerendered Japanese headline
- `curl -sI -H "Range: bytes=0-1" https://splitea.app/landing/assign-v1.hevc.mp4` returns `206`
- An unknown path returns 404; `/get` returns 302
- A real `/r/<id>` link still boots and works

## Known follow-ups

- Swap `public/landing/bezel-iphone-v1.webp` (the app's onboarding bezel) for the Figma deck bezel. A new bezel image needs its screen box (`.phone-shot-screen`, `.lp .device-frame` padding) and its visible outline re-measured from the alpha channel: the shadows in `landing.css` (`.phone-shot::before`, `.lp .device-frame::before`) use those exact insets, or a cream gap shows between metal and shadow. The demo's bottom bars get the 34 pt home-indicator inset from `--home-inset` in `landing.css`.
- Share-page `notFoundBody` says "iPhone or iPad"; the app is iPhone-only (all 10 locales).
- After JS loads the landing has two `h1`s, because the demo's Assign Items title is an `h1`.
- The Assign clip shows the English app on every language page; localizing it needs nine recordings.
- `public/og/splitea-en-v1-1200x630.png` was regenerated under its old `v1` name, so caches holding the old file keep it. A bump means a new name in `og.py`, `prerender.mjs` and `index.html`.
- Possible "Made with Splitea" footer on share pages: separate deploy, with the `/r/` regression test.
- `README.md` predates the landing; this file wins where they differ.
