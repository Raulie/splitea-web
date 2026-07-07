import type { ReceiptSnapshot, SnapshotEnvelope } from "../types/snapshot";

/// Base URL for the `splitea-shares` backend. Empty string =
/// same-origin: the SPA is served from `splitea.app/*` and the
/// `splitea-shares` worker owns `/r/*` and `/receipt/*` on the
/// SAME origin (see README route table), so every backend call
/// is a plain relative fetch. There is no separate API host and
/// no `VITE_*` env to thread through — keep this the single
/// source of truth so a future detached host only has to change
/// one constant.
///
/// Routing note: on `splitea.app` the `splitea-shares` worker is
/// only bound to `/r/*`, `/p/*`, `/live/*`, `.well-known`, and the
/// favicons — NOT bare `/receipt/*`. Backend calls that hit the
/// receipt DO over HTTP must therefore go through the `/live/`
/// prefix (see `claimPaid`), same as the iOS client.
export const apiBase = "";

/// Fetches the snapshot envelope from the public worker route
/// and returns the parsed `ReceiptSnapshot`. Same data the iOS
/// recipient gets when they tap a share link, just exposed
/// without the Apple-JWT auth gate (capability-based — anyone
/// with the shareID can already see this via the iOS app).
export async function fetchSnapshot(shareID: string): Promise<ReceiptSnapshot> {
  const response = await fetch(`${apiBase}/r/${encodeURIComponent(shareID)}/snapshot`);
  if (!response.ok) {
    throw new ShareFetchError(
      response.status === 404 ? "expired" : "fetch-failed",
      response.status,
    );
  }
  const envelope = (await response.json()) as SnapshotEnvelope;
  if (!envelope.snapshot) {
    throw new ShareFetchError("expired", 404);
  }
  const parsed = JSON.parse(envelope.snapshot) as ReceiptSnapshot;
  parsed.snapshotSeq = envelope.snapshotSeq ?? 0;
  return parsed;
}

/// Stateless "I paid" claim from a read-only per-recipient
/// visitor. POSTs `{ contactId, paid: true }` to the relay's
/// `/live/receipt/<id>/claim` endpoint. The relay records the
/// claim in its settlement store and broadcasts a
/// `settlement.markPaid` op to any connected peers — so we
/// deliberately DON'T open an edit WebSocket for the visitor (the
/// relay has no per-op authz, so a send-capable socket would
/// re-grant full edit rights). The POST is the entire write
/// surface a read-only visitor gets.
///
/// The `/live/` prefix is REQUIRED: on `splitea.app` only
/// `/r/*`, `/p/*`, `/live/*`, `.well-known`, and the favicons are
/// routed to `splitea-shares`. Bare `/receipt/*` is NOT routed —
/// it falls through to the `splitea-web` static-assets worker,
/// which 405s every POST. iOS reaches the same DO via
/// `splitea.app/live/receipt/*` (see `BackendShareService`); the
/// worker strips the `/live` prefix before matching `/receipt/:id/claim`.
///
/// `paid` is always `true` here — the web affordance is one-way
/// ("I paid"); there's no un-claim and no confirm on web.
export async function claimPaid(
  shareID: string,
  contactId: string,
): Promise<void> {
  const response = await fetch(
    `${apiBase}/live/receipt/${encodeURIComponent(shareID)}/claim`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId, paid: true }),
    },
  );
  if (!response.ok) {
    throw new ShareFetchError("fetch-failed", response.status);
  }
}

/// Carries the failure mode plus the underlying HTTP status so
/// the UI can render a meaningful empty state.
export class ShareFetchError extends Error {
  constructor(
    readonly kind: "expired" | "fetch-failed",
    readonly status: number,
  ) {
    super(kind);
  }
}
