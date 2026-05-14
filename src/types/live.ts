/// Wire-format types for the Splitea live WebSocket protocol.
/// Mirrors `Splitea/Services/LiveSessionProtocol.swift` 1:1 —
/// any change to op kinds / payloads on the iOS side must land
/// here too, or web peers will silently drop the new ops.
///
/// Discriminator on every frame is `type`. Frames are one
/// JSON object per WebSocket text frame.

// MARK: - Server → client

export type ServerMessage =
  | ServerHelloMessage
  | ServerMutationMessage
  | ServerPresenceMessage
  | ServerPongMessage
  | ServerRateLimitedMessage
  | ServerLockStatusChangedMessage;

export interface ServerHelloMessage {
  type: "hello";
  /// Server's view of our identity. Use this as the source of
  /// truth instead of the value we sent at connect — the relay
  /// could rewrite identity in future protocol versions.
  yourUserId: string;
  peers: PeerEntry[];
  /// Highest mutation seq currently in the log.
  latestSeq: number;
  /// Set when the relay's log no longer covers the `?resume=`
  /// seq we requested — we missed mutations and must refetch
  /// the snapshot before applying any further deltas.
  resumeGap?: boolean;
  /// Initial edit-lock state. When true, only the owner can
  /// mutate; peers' mutations are dropped server-side.
  editLocked?: boolean;
}

export interface ServerLockStatusChangedMessage {
  type: "lockStatusChanged";
  editLocked: boolean;
}

export interface ServerMutationMessage {
  type: "mutation";
  /// Client-minted UUID. Used by the original sender to dedupe
  /// replays after reconnect.
  id: string;
  /// Server-stamped — DO writes its own view of who sent the op
  /// from the upgrade-time `userId`. Cannot be spoofed by the
  /// sending client.
  senderUserId: string;
  /// Server timestamp (epoch ms).
  ts: number;
  /// Monotonic per-DO sequence number — total order across all
  /// peers. Persist the highest observed value so a reconnect
  /// can request `?resume=<lastSeenSeq>`.
  seq: number;
  op: MutationOp;
}

export interface ServerPresenceMessage {
  type: "presence";
  peers: PeerEntry[];
}

export interface ServerPongMessage {
  type: "pong";
}

export interface ServerRateLimitedMessage {
  type: "rate_limited";
  retryAfterMs: number;
}

export interface PeerEntry {
  userId: string;
  displayName?: string;
}

// MARK: - Client → server

export type ClientMessage =
  | ClientMutationMessage
  | ClientPresenceUpdateMessage
  | ClientPingMessage
  | ClientAckMessage;

export interface ClientMutationMessage {
  type: "mutation";
  /// Client-minted UUID — must be unique per logical op so
  /// replays can be deduped on the sender side.
  id: string;
  op: MutationOp;
}

export interface ClientPresenceUpdateMessage {
  type: "presence.update";
  displayName: string;
}

export interface ClientPingMessage {
  type: "ping";
}

export interface ClientAckMessage {
  type: "ack";
  seq: number;
}

// MARK: - Mutation ops

/// Discriminated union over the verbatim `kind` strings used on
/// the wire. Payload shapes are the strict superset enumerated
/// below; unused fields are absent rather than null.
export type MutationOp =
  | { kind: "assignment.add"; payload: AssignmentOpPayload }
  | { kind: "assignment.remove"; payload: AssignmentOpPayload }
  | { kind: "assignments.clear"; payload: Record<string, never> }
  | { kind: "split.evenly"; payload: Record<string, never> }
  | { kind: "item.add"; payload: ItemAddPayload }
  | { kind: "item.update"; payload: ItemUpdatePayload }
  | { kind: "item.delete"; payload: { itemId: string } }
  | { kind: "item.duplicate"; payload: { itemId: string; newItemId: string } }
  | { kind: "receipt.update"; payload: ReceiptUpdatePayload }
  | { kind: "tip.update"; payload: TipUpdatePayload }
  | { kind: "payer.update"; payload: PayerUpdatePayload }
  | { kind: "warning.dismissReceipt"; payload: { warningCode: string } }
  | { kind: "warning.dismissItem"; payload: { itemId: string; warningCode: string } }
  | { kind: string; payload: Record<string, unknown> }; // forward-compat

export interface AssignmentOpPayload {
  assignmentId: string;
  itemId: string;
  contactId: string;
}

export interface ItemAddPayload {
  itemId?: string;
  description: string;
  /// Decimal as STRING (preserves precision across language boundaries).
  price: string;
  tax?: string;
  sortOrder: number;
}

export interface ItemUpdatePayload {
  itemId: string;
  description?: string;
  price?: string;
  tax?: string;
  sortOrder?: number;
}

export interface ReceiptUpdatePayload {
  merchantName?: string;
  /// Empty string = clear; ISO string or epoch-ms number = set.
  receiptDate?: string | number;
}

export interface TipUpdatePayload {
  tipType: "percentage" | "amount";
  tipValue: string;
}

export interface PayerUpdatePayload {
  payerPhoneNumber?: string;
  payerContactId?: string;
}

/// Bulk ops echo back to the sender (so it learns the server
/// `seq` for race-settlement). Non-bulk ops do NOT — the sender
/// must apply those locally as optimistic updates.
export function isBulkOp(kind: string): boolean {
  return kind === "split.evenly" || kind === "assignments.clear";
}
