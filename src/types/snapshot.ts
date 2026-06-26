// TypeScript mirror of `ReceiptSnapshot` from
// `Splitea/Services/ReceiptSnapshot.swift`. The shape is the
// authoritative wire format the iOS app POSTs to the worker;
// keep these in sync if the Swift side changes.
//
// Date and Decimal handling: Swift's JSONEncoder emits Date as
// epoch milliseconds (because the encoder uses
// `.millisecondsSince1970`) and Decimal as a JSON number. So
// `receiptDate` arrives as `number | null` and prices arrive
// as plain numbers — no manual ISO-string parsing needed.

export interface SnapshotEnvelope {
  /// JSON-stringified `ReceiptSnapshot`. The worker stores the
  /// whole iOS POST body as opaque text and hands it back here
  /// verbatim — we parse on the client.
  snapshot: string;
  /// Owner's Apple `sub`. Only present on the authenticated
  /// fetch; the public share-link snapshot omits it (the SPA
  /// never needs it to render a receipt).
  ownerUserId?: string;
  /// Epoch ms.
  createdAt: number;
  /// Epoch ms — the 7-day TTL deadline.
  expiresAt: number;
}

export interface ReceiptSnapshot {
  version: number;
  receipt: ReceiptPayload;
  items: ItemPayload[];
  contacts: ContactPayload[];
  assignments: AssignmentPayload[];
}

export interface ReceiptPayload {
  id: string;
  merchantName: string | null;
  receiptDate: number | null;
  tipType: string;
  tipValue: number;
  /// Percentage tips: tip applies to subtotal + tax when true.
  /// Optional — older snapshots omit it; absent means pre-tax.
  tipPostTax?: boolean;
  currencyCode: string;
  receiptImageBase64: string | null;
  receiptMimeType: string;
  warningCodes: string[];
  taxRoundingMethod: string;
  taxInclusive: boolean;
  taxRate: number | null;
  payerPhoneNumber: string | null;
}

export interface ItemPayload {
  id: string;
  itemDescription: string;
  price: number;
  tax: number | null;
  sortOrder: number;
  warningCodes: string[];
}

export interface ContactPayload {
  id: string;
  phoneNumber: string;
  contactIdentifier: string | null;
  fullName: string | null;
  isUserContact: boolean;
  /// Payment-provider usernames the contact has configured,
  /// keyed by `PaymentProvider.rawValue` from the iOS enum
  /// (`venmo`, `cashApp`, `paypal`, `revolut`, `monzo`,
  /// `googlePayUPI`, `athMovil`). Only populated for the
  /// snapshot author's own contact (`isUserContact: true`).
  /// Optional — snapshots from iOS builds before this field
  /// existed simply omit it.
  paymentUsernames?: Record<string, string> | null;
  /// Public splitea-id avatar URL (with `?v=` cache-buster) for
  /// this participant. The snapshot author's iOS app stamps it
  /// in for any participant whose phone hashed into the
  /// directory at share-create time. Web fetches it directly
  /// from `avatars.splitea.app` (no auth required) and falls
  /// back to initials when null. Optional — older snapshots
  /// without the field decode unchanged.
  avatarUrl?: string | null;
  /// Short numeric identifier within the share, used in
  /// per-recipient URLs (`/r/<id>/c/<shortId>`) instead of the
  /// long UUID. Optional — older snapshots that pre-date the
  /// field omit it, and consumers fall back to UUID-prefix
  /// matching.
  shortId?: number | null;
  /// Settlement state — the debtor's "I paid" claim. Set true
  /// by anyone via the `settlement.markPaid` live op or the web
  /// `/receipt/<id>/claim` POST. Advisory only; `paid` alone is
  /// NOT "settled". Optional — the relay splices these onto each
  /// contact on read, so snapshots taken before any settlement
  /// activity omit them.
  paid?: boolean;
  /// Epoch ms when `paid` was last set. Drives last-writer-wins
  /// on both the relay and the client (`settlement.markPaid`
  /// only advances when its `at` is >= the stored `paidAt`). The
  /// relay can splice `null` (a record with paid set but no
  /// timestamp), so this is nullable, not just optional.
  paidAt?: number | null;
  /// Settlement state — the payer's confirmation that the debtor
  /// actually paid. Set only via `settlement.confirmPaid` (no
  /// web affordance — web can claim, never confirm). A contact
  /// is "settled" only when `paid && confirmed`.
  confirmed?: boolean;
  /// Epoch ms when `confirmed` was last set. Last-writer-wins,
  /// same rule as `paidAt`. Nullable for the same reason.
  confirmedAt?: number | null;
}

export interface AssignmentPayload {
  id: string;
  itemId: string;
  contactId: string;
}
