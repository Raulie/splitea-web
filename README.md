# splitea-web

Web client for Splitea share links. Deployed alongside the iOS
app at `splitea.app/r/<shareID>` so recipients without the iOS
app can view and interact with shared receipts in real time.

## Architecture

- **Solid** for fine-grained reactivity — WebSocket mutation broadcasts update only the affected DOM nodes.
- **Vite** for build, dev server, HMR.
- **TypeScript** end-to-end.
- **Tailwind** with iOS-system-color tokens so the dark theme
  visually matches the native iOS `ItemsView`.
- **Cloudflare Pages** hosts the static build at `splitea.app`.
- **Cloudflare Worker** (`splitea-live` repo) serves the
  `/r/<shareID>` entry HTML with per-receipt OG tags for
  iMessage / Slack / WhatsApp link previews; the same HTML
  bootstraps this SPA when opened in a regular browser.

## Routes

| Path | Owner | Behavior |
|------|-------|----------|
| `splitea.app/r/<id>` (Universal Link) | iOS app | Opens in the iOS app when installed |
| `splitea.app/r/<id>` (browser) | Worker → SPA | Worker returns HTML with OG meta + script tag; Pages-hosted bundle mounts here |
| `splitea.app/live/*` | Worker | API + WebSocket relay |
| `splitea.app/.well-known/*` | Worker | AASA, etc. |
| Everything else | Pages | This SPA + future marketing site |

## Local development

```bash
npm install
npm run dev      # http://localhost:5173
```

## Build

```bash
npm run build    # outputs dist/
npm run preview  # serves dist/ locally
```

## Deploy

Cloudflare Pages auto-deploys on push to `main` via the GitHub
integration. Build command: `npm run build`. Output directory: `dist`.
