import { createStore, produce } from "solid-js/store";
import type {
  AssignmentPayload,
  ReceiptSnapshot,
} from "../types/snapshot";
import type {
  AssignmentOpPayload,
  ItemAddPayload,
  ItemUpdatePayload,
  MutationOp,
  ReceiptUpdatePayload,
  TipUpdatePayload,
  PayerUpdatePayload,
} from "../types/live";

/// Reactive view of the receipt snapshot, mutated either by
/// incoming WebSocket frames (`applyMutation`) or by local
/// optimistic updates (the `apply*` helpers below, which we
/// invoke from the UI before sending the mutation upstream).
///
/// Solid's `createStore` gives us proxy-based fine-grained
/// reactivity — components that read `store.assignments`
/// only re-render when that array (or its members) changes,
/// not on every receipt-level edit. Critical when the
/// `ContactsRow` and `ItemsList` are watching different
/// slices of the same snapshot.
///
/// Idempotency: every apply path checks for existing rows
/// before inserting. The relay broadcasts mutations in total
/// order via `seq`, but the sender of a non-bulk op already
/// applied it locally as an optimistic update — without the
/// dedupe, a server echo of the bulk ops or a reconnect
/// replay would duplicate items.
export interface SnapshotStore {
  snapshot: ReceiptSnapshot;
  /// Server's view of our identity — set after `hello`.
  selfUserId: string | null;
  /// Highest `seq` we've applied. Persisted across
  /// reconnects via the LiveSession's `initialResumeSeq`.
  lastSeenSeq: number;
  /// Mirrors the relay's edit-lock state. When true, peers
  /// can't mutate; UI should suppress edit affordances and
  /// taps should no-op locally.
  editLocked: boolean;
}

/// Legacy localStorage key — we used to persist the cursor
/// so reconnects could `?resume=`. That backfired: a fresh
/// page load re-fetches the stale snapshot blob (captured at
/// share creation, before later assignments) and the
/// persisted cursor told the relay to skip the mutations
/// that materialized the current state. Every reload looked
/// "all assignments cleared." We now keep the cursor purely
/// in-memory; the cleanup below evicts stale persistence
/// from previous deploys so old visitors get unstuck on
/// next load.
const LEGACY_SEQ_STORAGE_PREFIX = "splitea.lastSeenSeq.";

export function createSnapshotStore(initial: ReceiptSnapshot, shareID: string) {
  // One-shot eviction of the legacy persisted cursor.
  try {
    localStorage.removeItem(LEGACY_SEQ_STORAGE_PREFIX + shareID);
  } catch {
    /* swallow — localStorage may be blocked */
  }

  const [store, setStore] = createStore<SnapshotStore>({
    snapshot: initial,
    selfUserId: null,
    lastSeenSeq: 0,
    editLocked: false,
  });

  /// Apply a server-broadcast mutation to the store. Runs
  /// inside `produce` so multiple field writes happen in a
  /// single reactive batch.
  function applyMutation(op: MutationOp, seq: number) {
    setStore(
      produce((state) => {
        applyOp(state.snapshot, op);
        if (seq > state.lastSeenSeq) {
          state.lastSeenSeq = seq;
        }
      }),
    );
  }

  /// Optimistic local apply for outgoing mutations. The
  /// server doesn't echo non-bulk ops back to the sender, so
  /// we need to update locally before the wire trip — same
  /// shape as `applyMutation` but without bumping seq.
  function applyOptimistic(op: MutationOp) {
    setStore(
      produce((state) => {
        applyOp(state.snapshot, op);
      }),
    );
  }

  function setSelfUserId(id: string) {
    setStore("selfUserId", id);
  }

  function setEditLocked(locked: boolean) {
    setStore("editLocked", locked);
  }

  return {
    store,
    applyMutation,
    applyOptimistic,
    setSelfUserId,
    setEditLocked,
  };
}

// MARK: - Op dispatch

function applyOp(snap: ReceiptSnapshot, op: MutationOp): void {
  switch (op.kind) {
    case "assignment.add":
      applyAssignmentAdd(snap, op.payload as AssignmentOpPayload);
      return;
    case "assignment.remove":
      applyAssignmentRemove(snap, op.payload as AssignmentOpPayload);
      return;
    case "assignments.clear":
      snap.assignments.length = 0;
      return;
    case "split.evenly":
      applySplitEvenly(snap);
      return;
    case "item.add":
      applyItemAdd(snap, op.payload as ItemAddPayload);
      return;
    case "item.update":
      applyItemUpdate(snap, op.payload as ItemUpdatePayload);
      return;
    case "item.delete":
      applyItemDelete(snap, (op.payload as { itemId: string }).itemId);
      return;
    case "item.duplicate":
      applyItemDuplicate(
        snap,
        op.payload as { itemId: string; newItemId: string },
      );
      return;
    case "receipt.update":
      applyReceiptUpdate(snap, op.payload as ReceiptUpdatePayload);
      return;
    case "tip.update":
      applyTipUpdate(snap, op.payload as TipUpdatePayload);
      return;
    case "payer.update":
      applyPayerUpdate(snap, op.payload as PayerUpdatePayload);
      return;
    case "warning.dismissReceipt": {
      const code = (op.payload as { warningCode: string }).warningCode;
      snap.receipt.warningCodes = snap.receipt.warningCodes.filter(
        (c) => c !== code,
      );
      return;
    }
    case "warning.dismissItem": {
      const { itemId, warningCode } = op.payload as {
        itemId: string;
        warningCode: string;
      };
      const item = snap.items.find((i) => i.id === itemId);
      if (item) {
        item.warningCodes = item.warningCodes.filter((c) => c !== warningCode);
      }
      return;
    }
    case "profile.update":
      applyProfileUpdate(snap, op.payload as ProfileUpdatePayload);
      return;
    default:
      // Forward-compat: ignore unknown ops. iOS does the same.
      return;
  }
}

interface ProfileUpdatePayload {
  profilePhoneE164?: string;
  profileFirstName?: string;
  profileLastName?: string;
  /// JSON-encoded `Record<string, string>` keyed by
  /// `PaymentProvider.rawValue`. Empty string clears all.
  profilePaymentUsernamesJson?: string;
  /// Empty string clears the avatar (renderer falls back to
  /// initials).
  profileAvatarUrl?: string;
}

/// Applies a peer's `profile.update` mutation to the snapshot.
/// Correlates by `profilePhoneE164` against `contact.phoneNumber`
/// (suffix-match on digits to handle country-code variance).
/// Updates fullName, avatarUrl, and (for the contact's own row)
/// paymentUsernames in place — Solid's reactive store sees the
/// mutation and re-renders every component reading those fields.
function applyProfileUpdate(
  snap: ReceiptSnapshot,
  payload: ProfileUpdatePayload,
): void {
  const phoneE164 = payload.profilePhoneE164;
  if (!phoneE164) return;
  const needleDigits = phoneE164.replace(/\D/g, "");
  if (!needleDigits) return;

  const contact = snap.contacts.find((c) => {
    const d = c.phoneNumber.replace(/\D/g, "");
    if (!d) return false;
    const n = Math.min(d.length, needleDigits.length, 10);
    return d.slice(-n) === needleDigits.slice(-n);
  });
  if (!contact) return;

  // Name update — both fields present means "set"; either being
  // an empty string clears that segment. iOS encodes the same
  // sentinel.
  if (
    payload.profileFirstName !== undefined ||
    payload.profileLastName !== undefined
  ) {
    const first = (payload.profileFirstName ?? "").trim();
    const last = (payload.profileLastName ?? "").trim();
    const combined = `${first} ${last}`.trim();
    contact.fullName = combined.length > 0 ? combined : null;
  }

  // Avatar update — empty string clears.
  if (payload.profileAvatarUrl !== undefined) {
    contact.avatarUrl = payload.profileAvatarUrl.length > 0
      ? payload.profileAvatarUrl
      : null;
  }

  // Payment usernames — only meaningful for the contact's own
  // row (`isUserContact: true`). For non-user rows we don't
  // surface payment-username UI on web today (the Pay button
  // only renders for the snapshot author's own contact), so
  // applying the field for everyone is harmless and keeps the
  // store self-consistent if/when web grows recipient-side
  // payment UX.
  if (payload.profilePaymentUsernamesJson !== undefined) {
    if (payload.profilePaymentUsernamesJson.length === 0) {
      contact.paymentUsernames = null;
    } else {
      try {
        const parsed = JSON.parse(payload.profilePaymentUsernamesJson) as
          | Record<string, string>
          | null;
        contact.paymentUsernames = parsed && typeof parsed === "object"
          ? parsed
          : null;
      } catch {
        // Malformed JSON — leave the existing value intact
        // rather than wiping. iOS encodes via JSONEncoder so
        // this should never trip in practice.
      }
    }
  }
}

function applyAssignmentAdd(
  snap: ReceiptSnapshot,
  payload: AssignmentOpPayload,
) {
  // Dedupe by id (server replay) AND by (itemId, contactId)
  // tuple (concurrent add from another peer that we already
  // applied locally with a different assignmentId).
  //
  // CRITICAL: id-based dedup is GATED on `assignmentId` being
  // present. iOS broadcasts assignment.add/remove WITHOUT an
  // `assignmentId` field — only itemId + contactId. If we
  // checked `a.id === undefined` we'd match the FIRST id-less
  // row stored and silently skip every subsequent iOS-side
  // add, since they all carry `assignmentId: undefined`. That
  // bug let iOS users add 10 assignments and the web saw only
  // the first. Tuple dedup below handles the iOS path
  // correctly; id dedup is purely for the web→web echo case
  // where assignmentIds are real.
  if (
    payload.assignmentId &&
    snap.assignments.some((a) => a.id === payload.assignmentId)
  ) {
    return;
  }
  if (
    snap.assignments.some(
      (a) =>
        a.itemId === payload.itemId && a.contactId === payload.contactId,
    )
  ) {
    return;
  }
  const row: AssignmentPayload = {
    id: payload.assignmentId,
    itemId: payload.itemId,
    contactId: payload.contactId,
  };
  snap.assignments.push(row);
}

function applyAssignmentRemove(
  snap: ReceiptSnapshot,
  payload: AssignmentOpPayload,
) {
  // Match by id when possible (ideal), fall back to the
  // tuple — different peers may have generated different
  // assignmentIds for the same conceptual edge before they
  // converge on the relay's order.
  //
  // Same `assignmentId &&` guard as `applyAssignmentAdd`:
  // iOS broadcasts removes without an assignmentId, so a
  // direct `findIndex(a => a.id === undefined)` would match
  // the first id-less row regardless of which (item,contact)
  // pair the iOS user actually de-assigned — silently
  // corrupting state. Skip id-find when assignmentId is
  // missing and rely on the tuple match.
  let idx = -1;
  if (payload.assignmentId) {
    idx = snap.assignments.findIndex((a) => a.id === payload.assignmentId);
  }
  if (idx === -1) {
    idx = snap.assignments.findIndex(
      (a) =>
        a.itemId === payload.itemId && a.contactId === payload.contactId,
    );
  }
  if (idx >= 0) snap.assignments.splice(idx, 1);
}

function applySplitEvenly(snap: ReceiptSnapshot) {
  // "Split evenly" assigns every item to every contact —
  // the iOS BillCalculation logic interprets this as the
  // baseline state. We materialize it as concrete
  // assignments so the rest of the math (per-item per-
  // contact subtotal) keeps working unchanged.
  snap.assignments.length = 0;
  for (const item of snap.items) {
    for (const contact of snap.contacts) {
      snap.assignments.push({
        id: `even-${item.id}-${contact.id}`,
        itemId: item.id,
        contactId: contact.id,
      });
    }
  }
}

function applyItemAdd(snap: ReceiptSnapshot, payload: ItemAddPayload) {
  const id = payload.itemId ?? cryptoRandomId();
  if (snap.items.some((i) => i.id === id)) return;
  snap.items.push({
    id,
    itemDescription: payload.description,
    price: parseDecimal(payload.price),
    tax: payload.tax !== undefined ? parseDecimal(payload.tax) : null,
    sortOrder: payload.sortOrder,
    warningCodes: [],
  });
}

function applyItemUpdate(snap: ReceiptSnapshot, payload: ItemUpdatePayload) {
  const item = snap.items.find((i) => i.id === payload.itemId);
  if (!item) return;
  if (payload.description !== undefined) item.itemDescription = payload.description;
  if (payload.price !== undefined) item.price = parseDecimal(payload.price);
  if (payload.tax !== undefined) item.tax = parseDecimal(payload.tax);
  if (payload.sortOrder !== undefined) item.sortOrder = payload.sortOrder;
}

function applyItemDelete(snap: ReceiptSnapshot, itemId: string) {
  const idx = snap.items.findIndex((i) => i.id === itemId);
  if (idx >= 0) snap.items.splice(idx, 1);
  snap.assignments = snap.assignments.filter((a) => a.itemId !== itemId);
}

function applyItemDuplicate(
  snap: ReceiptSnapshot,
  payload: { itemId: string; newItemId: string },
) {
  const src = snap.items.find((i) => i.id === payload.itemId);
  if (!src) return;
  if (snap.items.some((i) => i.id === payload.newItemId)) return;
  snap.items.push({
    ...src,
    id: payload.newItemId,
    sortOrder: src.sortOrder + 0.5,
  });
}

function applyReceiptUpdate(
  snap: ReceiptSnapshot,
  payload: ReceiptUpdatePayload,
) {
  if (payload.merchantName !== undefined) {
    snap.receipt.merchantName = payload.merchantName || null;
  }
  if (payload.receiptDate !== undefined) {
    if (typeof payload.receiptDate === "number") {
      snap.receipt.receiptDate = payload.receiptDate;
    } else if (payload.receiptDate === "") {
      snap.receipt.receiptDate = null;
    } else {
      const ts = Date.parse(payload.receiptDate);
      snap.receipt.receiptDate = Number.isFinite(ts) ? ts : null;
    }
  }
}

function applyTipUpdate(snap: ReceiptSnapshot, payload: TipUpdatePayload) {
  snap.receipt.tipType = payload.tipType;
  snap.receipt.tipValue = parseDecimal(payload.tipValue);
}

function applyPayerUpdate(snap: ReceiptSnapshot, payload: PayerUpdatePayload) {
  if (payload.payerPhoneNumber !== undefined) {
    snap.receipt.payerPhoneNumber = payload.payerPhoneNumber || null;
  }
  // payerContactId is iOS-internal; we don't surface it on the
  // snapshot directly (the phone number drives the UI).
}

// MARK: - Helpers

function parseDecimal(raw: string | number | undefined): number {
  if (typeof raw === "number") return raw;
  if (!raw) return 0;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : 0;
}

function cryptoRandomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `local-${Math.random().toString(36).slice(2)}`;
}

