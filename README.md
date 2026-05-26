# splitea-web

Web client for [Splitea](https://github.com/Raulie/Splitea) share links. Deployed at `splitea.app` as the catchall for the apex domain — when a share link opens in a browser instead of the iOS app, this SPA mounts and connects to the same `splitea-shares` WebSocket relay the native client uses.

## Architecture

- **Solid** for fine-grained reactivity — WebSocket mutation broadcasts update only the affected DOM nodes, no virtual-DOM diff.
- **Vite** for build, dev server, HMR.
- **TypeScript** end-to-end.
- **Tailwind** with iOS-system-color tokens so the dark theme visually matches the native iOS `ItemsView`.
- **Cloudflare Workers static-assets** binding hosts the build (`dist/`) at `splitea.app`.

## Routes (cross-worker)

`splitea.app` is shared by four workers via path-precedence routing. Cloudflare picks the most specific match.

| Path | Worker | Behaviour |
|------|--------|-----------|
| `splitea.app/r/<id>` (Universal Link) | iOS app | Opens in the iOS app when installed |
| `splitea.app/r/*`, `splitea.app/p/*`, `splitea.app/live/*`, `splitea.app/.well-known/*` | `splitea-shares` | Share-link HTML with per-receipt OG tags, ATH Móvil pay landing, WebSocket relay, AASA |
| `splitea.app/id/*` | `splitea-id` | Profile + identity API |
| `splitea.app/legal/*` | `splitea-legal` | Privacy / Terms / Support static pages |
| Everything else | this worker | SPA + future marketing surface |

## Local development

```bash
npm install
npm run dev      # http://localhost:5173
```

## Build + deploy

```bash
npm run build    # outputs dist/
npx wrangler deploy
```

## Related repos

- [Splitea](https://github.com/Raulie/Splitea) — iOS client.
- [splitea-shares](https://github.com/Raulie/splitea-shares) — share-link HTML + WebSocket relay this SPA connects to.
- [splitea-id](https://github.com/Raulie/splitea-id) — profile + identity API.
