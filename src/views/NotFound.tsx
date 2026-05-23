/// Fallback for any path that isn't `/r/<id>`. The marketing
/// site will eventually live at `/` — until then, we just nudge
/// people back to the App Store.
export function NotFound() {
  return (
    <div class="min-h-dvh flex flex-col items-center justify-center p-6 text-center gap-4">
      <SpliteaLogo />
      <h1 class="text-ios-title-2">Splitea</h1>
      <p class="text-ios-label-secondary text-ios-body max-w-xs">
        That link doesn't look right. Open Splitea on your iPhone or
        iPad to start a new split.
      </p>
      <a
        class="mt-4 px-6 py-3 rounded-full bg-ios-blue text-white font-semibold no-underline"
        href="https://apps.apple.com/app/splitea/id6760237781"
      >
        Get Splitea
      </a>
    </div>
  );
}

/// Inlined Splitea brand mark. Same paths used on the legal
/// pages and the admin console (see
/// `splitea-legal/dist/legal/logo.svg`). `fill="currentColor"`
/// + a `text-ios-label` wrapper picks up the foreground color
/// so it renders correctly under either color scheme.
function SpliteaLogo() {
  return (
    <svg
      viewBox="0 0 400 672"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      class="text-ios-label"
      style={{ width: "48px", height: "64px" }}
    >
      <path d="M283.862 238.563C394.874 302.746 432.953 444.821 368.915 555.895C304.877 666.969 162.97 704.982 51.9581 640.799C51.7784 640.695 51.5994 640.59 51.4201 640.486L283.322 238.253C283.502 238.356 283.682 238.459 283.862 238.563Z" />
      <path d="M305.526 11.984C320.035 16.8555 334.276 23.2417 348.041 31.2006C348.221 31.3045 348.4 31.4094 348.58 31.5137L116.678 433.747C116.498 433.644 116.318 433.541 116.138 433.437C102.372 425.478 89.7289 416.32 78.2617 406.174L305.526 11.984Z" />
      <path d="M204.565 1.64437C222.213 -0.466666 240.159 -0.561847 258.041 1.4558L45.4142 370.256C34.7286 355.757 25.8379 340.146 18.8394 323.785L204.565 1.64437Z" />
      <path d="M31.0849 116.105C57.2791 70.6708 96.5016 37.4614 141.309 18.4699L1.76218 260.514C-4.21754 212.159 4.8907 161.538 31.0849 116.105Z" />
    </svg>
  );
}
