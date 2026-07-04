/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // iOS system colors wired through CSS variables so a
        // single `bg-ios-card` or `text-ios-label` class
        // resolves to the right value in light AND dark mode.
        // Both palettes are declared in `src/index.css` —
        // light is the default, dark gets swapped in via the
        // `@media (prefers-color-scheme: dark)` block. The
        // page also declares `color-scheme: light dark` so
        // Chromium's auto-dark detection sees that we're
        // handling theming ourselves and skips force-dark.
        //
        // For each token, the dark value matches the SwiftUI
        // dark-appearance color; the light value matches the
        // SwiftUI light-appearance color (e.g. systemBlue
        // `#007aff` light vs `#0a84ff` dark). When in doubt,
        // these mirror what `UIColor.systemX.resolvedColor`
        // would return on iOS in the corresponding trait.
        "ios-bg":              "var(--ios-bg)",
        "ios-card":            "var(--ios-card)",
        "ios-card-hi":         "var(--ios-card-hi)",
        "ios-gray-fill":       "var(--ios-gray-fill)",
        "ios-gray-fill-dim":   "var(--ios-gray-fill-dim)",
        "ios-separator":       "var(--ios-separator)",
        "ios-label":           "var(--ios-label)",
        "ios-label-secondary": "var(--ios-label-secondary)",
        "ios-label-tertiary":  "var(--ios-label-tertiary)",
        "ios-blue":            "var(--ios-blue)",
        "ios-red":             "var(--ios-red)",
        "ios-green":           "var(--ios-green)",
        "ios-orange":          "var(--ios-orange)",
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
        // Radii are driven by CSS variables declared in
        // `src/index.css`. The base values match the iOS app's
        // actual usage (22pt cards, 36pt sheets, 12pt tags,
        // 10pt inner shapes via the concentric rule
        // inner_radius = parent_radius − padding).
        //
        // Safari renders these via `corner-shape: superellipse(3)`
        // (the `.squircle` class) and the result matches the
        // native iOS continuous corner perfectly. Chromium has
        // no superellipse support, so a plain `border-radius`
        // of 22pt looks visibly tighter than the SwiftUI
        // equivalent. To compensate, the `@supports not
        // (corner-shape: superellipse(3))` block in index.css
        // bumps each variable by ~25% so the circular-arc
        // fallback approximates the squircle's perceived size.
        // Single source of truth for both paths: change the
        // variables, every consumer follows.
        "ios-card":       "var(--radius-ios-card)",
        "ios-card-inner": "var(--radius-ios-card-inner)",
        "ios-sheet":      "var(--radius-ios-sheet)",
        "ios-tag":        "var(--radius-ios-tag)",
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
