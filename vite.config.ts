import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

// Stable, hash-free filenames for the entry bundle (`main.js`,
// `main.css`). The splitea-live worker hardcodes those URLs in
// the `/r/<id>` HTML response so iMessage's preview crawler
// can read OG tags AND a browser visitor can run the SPA from
// the same response — no version manifest dance, no extra
// fetch hop. Cache invalidation falls back to Cloudflare's
// short Cache-Control on these assets (300s by default), which
// is the right trade-off for an evolving SPA.
//
// Code-split chunks keep their content hashes so cache-busting
// works correctly for the rest of the bundle as it grows.
export default defineConfig({
  plugins: [solid()],
  build: {
    rollupOptions: {
      output: {
        entryFileNames: "assets/main.js",
        chunkFileNames: "assets/chunk-[hash].js",
        assetFileNames: ({ name }) => {
          if (name?.endsWith(".css")) return "assets/main.css";
          return "assets/[name]-[hash][extname]";
        },
      },
    },
  },
});
