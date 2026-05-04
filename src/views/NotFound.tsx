/// Fallback for any path that isn't `/r/<id>`. The marketing
/// site will eventually live at `/` — until then, we just nudge
/// people back to the App Store.
export function NotFound() {
  return (
    <div class="min-h-dvh flex flex-col items-center justify-center p-6 text-center gap-4">
      <h1 class="text-ios-title-2">Splitea</h1>
      <p class="text-ios-label-secondary text-ios-body max-w-xs">
        That link doesn't look right. Open Splitea on your iPhone or
        iPad to start a new split.
      </p>
      <a
        class="mt-4 px-6 py-3 rounded-full bg-ios-blue text-white font-semibold no-underline"
        href="https://apps.apple.com/app/splitea/id0"
      >
        Get Splitea
      </a>
    </div>
  );
}
