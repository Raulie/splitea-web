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
  ownerUserId: string;
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
}

export interface AssignmentPayload {
  id: string;
  itemId: string;
  contactId: string;
}
