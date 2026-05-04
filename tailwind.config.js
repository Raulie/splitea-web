/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Match iOS system colors so the web ItemsView reads
        // identically to the native one. Pinning hex values
        // rather than CSS-system tokens because non-Apple devices
        // don't have iOS's `-apple-system-*` tokens — keeping
        // the rendered look consistent across platforms.
        "ios-bg":              "#000000",
        "ios-card":            "#1c1c1e",
        "ios-card-hi":         "#2c2c2e",
        "ios-separator":       "rgba(84,84,88,0.65)",
        "ios-label":           "#ffffff",
        "ios-label-secondary": "rgba(235,235,245,0.6)",
        "ios-label-tertiary":  "rgba(235,235,245,0.3)",
        // UIColor.systemBlue (dark appearance) — same accent
        // UIKit uses for tinted buttons / links in dark mode.
        "ios-blue":            "#0a84ff",
        "ios-red":             "#ff453a",
      },
      fontFamily: {
        // Apple devices auto-resolve to SF Pro via `-apple-system`;
        // non-Apple devices land on Inter (shipped as a webfont).
        // Result: SF Pro on iOS/macOS, Inter (close enough)
        // elsewhere — same hierarchy, same vertical rhythm.
        sf: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"SF Pro Display"',
          '"SF Pro Text"',
          "Inter",
          "system-ui",
          "sans-serif",
        ],
      },
      borderRadius: {
        "ios-card": "14px",
      },
      fontSize: {
        "ios-large-title": ["34px", { lineHeight: "41px", fontWeight: "700" }],
        "ios-title-1":     ["28px", { lineHeight: "34px", fontWeight: "700" }],
        "ios-title-2":     ["22px", { lineHeight: "28px", fontWeight: "600" }],
        "ios-title-3":     ["20px", { lineHeight: "25px", fontWeight: "600" }],
        "ios-headline":    ["17px", { lineHeight: "22px", fontWeight: "600" }],
        "ios-body":        ["17px", { lineHeight: "22px", fontWeight: "400" }],
        "ios-callout":     ["16px", { lineHeight: "21px", fontWeight: "400" }],
        "ios-subheadline": ["15px", { lineHeight: "20px", fontWeight: "400" }],
        "ios-footnote":    ["13px", { lineHeight: "18px", fontWeight: "400" }],
        "ios-caption":     ["12px", { lineHeight: "16px", fontWeight: "400" }],
      },
    },
  },
  plugins: [],
};
