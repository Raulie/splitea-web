/// Wrapper around `document.startViewTransition` with a
/// graceful fallback for browsers / contexts that don't
/// support the View Transitions API (Safari < 16, Firefox <
/// 144 — the API became Baseline Newly Available in October
/// 2025). The fallback just runs the mutation synchronously
/// without animation, so the UX still works on older clients.
///
/// Usage:
///
/// ```ts
/// withViewTransition(() => setActiveContactId(newId));
/// ```
///
/// The `update` callback runs inside the browser's
/// "snapshot DOM, mutate, re-snapshot, animate" sandwich.
/// Solid mutations inside the callback are picked up
/// synchronously by the time the function returns, which is
/// exactly what the View Transitions API expects.
export function withViewTransition(update: () => void): void {
  // `lib.dom` now types `startViewTransition` directly on
  // Document (the API is Baseline as of Oct 2025). Old browsers
  // still drop it at runtime, hence the explicit feature
  // check — TS lets us through because the property exists in
  // the type, JS guards against the older runtimes.
  const start = (
    document as Document & {
      startViewTransition?: (cb: () => void) => unknown;
    }
  ).startViewTransition;
  if (typeof start === "function") {
    // The browser handles all the FLIP math: it captures the
    // bounding-box of every element with a `view-transition-
    // name` BEFORE running `update`, then again AFTER, then
    // interpolates position + size + opacity across both
    // snapshots over the default 250ms (CSS controllable via
    // `::view-transition-group(*)`).
    start.call(document, update);
    return;
  }
  update();
}
