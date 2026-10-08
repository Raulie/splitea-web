import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

export default defineConfig({
  plugins: [solid({ ssr: true, solid: { hydratable: false } })],
  build: {
    ssr: "src/entry-landing-ssr.tsx",
    outDir: "dist-ssr",
    emptyOutDir: true,
  },
});
