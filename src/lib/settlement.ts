import type { ContactPayload } from "../types/snapshot";

/// Per-contact settlement state, derived from the `paid` /
/// `confirmed` fields the relay splices onto each
/// `ContactPayload`. Single source of truth shared by every
/// surface that renders the state (the breakdown rows and the
/// Pay bar advisory):
///
///   • "settled"  — debtor claimed paid AND payer confirmed it
///                  (`paid && confirmed`). The only state that
///                  reads as "done".
///   • "pending"  — debtor claimed paid but the payer hasn't
///                  confirmed yet (`paid && !confirmed`).
///   • "owes"     — no claim yet (the default for a contact who
///                  hasn't marked paid).
///
/// CRITICAL: a web "I paid" claim sets `paid` only — never
/// `confirmed`. So the web claim can move a contact to "pending"
/// but never to "settled"; only a `settlement.confirmPaid` op
/// (payer-initiated, no web affordance) flips `confirmed`.
export type SettlementState = "settled" | "pending" | "owes";

export function settlementState(contact: ContactPayload): SettlementState {
  const paid = contact.paid === true;
  const confirmed = contact.confirmed === true;
  if (paid && confirmed) return "settled";
  if (paid) return "pending";
  return "owes";
}
