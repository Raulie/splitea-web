import type { ReceiptSnapshot, SnapshotEnvelope } from "../types/snapshot";

/// Fetches the snapshot envelope from the public worker route
/// and returns the parsed `ReceiptSnapshot`. Same data the iOS
/// recipient gets when they tap a share link, just exposed
/// without the Apple-JWT auth gate (capability-based — anyone
/// with the shareID can already see this via the iOS app).
export async function fetchSnapshot(shareID: string): Promise<ReceiptSnapshot> {
  const response = await fetch(`/r/${encodeURIComponent(shareID)}/snapshot`);
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
  return JSON.parse(envelope.snapshot) as ReceiptSnapshot;
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
