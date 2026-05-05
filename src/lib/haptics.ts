/// Brief tactile feedback on user actions where the platform
/// supports it.
///
/// Wraps the WHATWG Vibration API (`navigator.vibrate(ms)`).
/// Browser support reality:
///   • Android Chrome / Firefox / Edge — supported.
///   • iOS Safari — NOT supported. Apple has resisted exposing
///     Web Vibration on the open web; the call falls through
///     as a no-op (the `typeof` guard catches it before throw).
///     Splitea-iOS users who follow a share link in Safari
///     therefore won't feel the haptic, but that's an Apple-
///     side limitation we can't bypass from the web.
///   • Desktop browsers — no-op (no haptic hardware).
///
/// We treat haptics as "if the platform offers it, fire it;
/// if not, ignore" — never a critical UX dependency. Wrapping
/// in a `try/catch` is defensive: some browsers throw if
/// `vibrate` is called outside a user-gesture context, even
/// though we always invoke it from click/tap handlers (the
/// throw would still abort the rest of the handler if not
/// caught).
///
/// Suggested durations, calibrated to feel like iOS
/// `UIImpactFeedbackGenerator` styles:
///   • LIGHT  (~10ms) — selection / item toggle
///   • MEDIUM (~15ms) — button submit
///   • HEAVY  (~25ms) — destructive confirm
export const HAPTIC_LIGHT = 10;
export const HAPTIC_MEDIUM = 15;
export const HAPTIC_HEAVY = 25;

export function triggerHaptic(durationMs: number = HAPTIC_LIGHT): void {
  if (typeof navigator === "undefined") return;
  if (typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(durationMs);
  } catch {
    /* swallow — see comment above on user-gesture context */
  }
}
