/// A guest userId is a UUID minted in the browser the first
/// time the SPA boots and persisted in localStorage. The
/// `web-` prefix marks it as not-an-Apple-sub on the relay
/// side (iOS uses opaque Apple `sub` claims, which never
/// start with `web-`), so peers can distinguish guests in
/// future presence UI without us touching the wire format.
///
/// Same userId is reused across reconnects and tabs so a
/// brief network blip doesn't fragment the user's presence
/// into multiple ghost peers. New userIds only appear on
/// fresh browsers / private windows / cleared storage.
const STORAGE_KEY = "splitea.guestUserId";
const STORAGE_KEY_DISPLAY = "splitea.guestDisplayName";

export function getGuestUserId(): string {
  // Bail to a per-session ephemeral id if localStorage is
  // unavailable (Safari private browsing, sandboxed iframes,
  // etc.). Worst case the guest looks like a new peer on
  // every reload.
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch {
    /* localStorage blocked — fall through */
  }
  if (stored && stored.startsWith("web-")) return stored;

  const fresh = `web-${cryptoUUID()}`;
  try {
    localStorage.setItem(STORAGE_KEY, fresh);
  } catch {
    /* swallow — id still good for the lifetime of this tab */
  }
  return fresh;
}

/// Optional display name — for now we don't prompt for one,
/// so this returns `undefined` and the relay shows the user
/// as just a userId in presence. Hook this up to the future
/// SIWA name claim or an in-page "Set your name" affordance.
export function getGuestDisplayName(): string | undefined {
  try {
    return localStorage.getItem(STORAGE_KEY_DISPLAY) ?? undefined;
  } catch {
    return undefined;
  }
}

/// Wraps `crypto.randomUUID()` with a fallback for older
/// Safari versions that haven't shipped it yet (it's been
/// supported since Safari 15.4 — pre-2022 — but defensive
/// programming is cheap).
function cryptoUUID(): string {
  // `crypto.randomUUID` has been in every shipping browser
  // since Safari 15.4 / Chrome 92 (2021-2022) — the feature
  // detection here is purely defensive against ancient WebViews
  // that might still be in the wild. We cast through `unknown`
  // to dodge TS narrowing `crypto` to `never` in the fallback
  // branch (it has built-in lib.dom typing that gets aggressive
  // when we use `typeof === "undefined"` checks).
  const g = globalThis as unknown as { crypto?: Crypto };
  const c: Crypto | undefined = g.crypto;
  if (c && typeof c.randomUUID === "function") {
    return c.randomUUID();
  }
  // RFC4122 v4 fallback. Not cryptographically as strong as
  // `crypto.randomUUID` but close enough for an attribution
  // id that's already capability-bound to the share link.
  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === "function") {
    c.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
  return (
    hex.slice(0, 4).join("") +
    "-" +
    hex.slice(4, 6).join("") +
    "-" +
    hex.slice(6, 8).join("") +
    "-" +
    hex.slice(8, 10).join("") +
    "-" +
    hex.slice(10, 16).join("")
  );
}

/// Random UUID for one-off mutation ids. Same fallback chain
/// as `cryptoUUID` above — no `web-` prefix here because
/// mutation ids are opaque to the relay.
export function newMutationId(): string {
  return cryptoUUID();
}
