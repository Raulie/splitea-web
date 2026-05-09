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
        // iOS `Color.gray.opacity(0.5)` — verbatim from
        // `ContactAvatar.swift`'s
        // `backgroundColor: Color.gray.opacity(0.5)`. The
        // critical bit is the **alpha**: SwiftUI composites this
        // fill over whatever's behind it (card bg, highlighted-
        // row bg, the bottom-bar's translucent scrim, etc.), so
        // the avatar takes on a slightly different gray
        // depending on context. Solid `#47474A` would only
        // match in the over-pure-black case and look wrong over
        // the lighter row backgrounds.
        //
        // `rgba(142, 142, 147, 0.5)` is iOS systemGray (dark
        // appearance, `#8E8E93`) at 0.5 alpha — the browser
        // alpha-blends it over the parent the same way
        // SwiftUI's compositor does.
        "ios-gray-fill":       "rgba(142,142,147,0.5)",
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
        // iOS 26 — 22pt for prominent grouped-list cards.
        // Matches the iOS app's actual usage (`cornerRadius: 22,
        // style: .continuous` on every prominent card surface:
        // ContactBreakdownRow, OnboardingProfilePageView,
        // ProfileSetupPageView, ItemsView grouped lists).
        // Earlier passes of this file experimented with 28pt and
        // 36pt — both diverged from what iOS actually renders,
        // making the web feel inflated next to the native app.
        //
        // Concentric rule: inner_radius = parent_radius
        // − padding. With a 22pt outer card and ~12pt padding
        // (`px-3 py-3` inside PayMenuSheet rows), nested shapes
        // want roughly 10pt; exposed below as `ios-card-inner`.
        "ios-card":       "22px",
        "ios-card-inner": "10px",
        // Smaller "tag" pills (date / time chips inside the
        // receipt-info card) — bumped from `rounded-lg`
        // (8pt) to 12pt so they breathe alongside the
        // larger card radius.
        "ios-tag":        "12px",
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
        "ios-caption2":    ["11px", { lineHeight: "13px", fontWeight: "400" }],
      },
    },
  },
  plugins: [],
};
