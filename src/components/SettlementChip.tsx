import { Show } from "solid-js";
import type { SettlementState } from "../lib/settlement";
import { CheckmarkGlyph } from "./CheckmarkGlyph";

/// Small, quiet advisory chip for a contact's settlement state.
/// Rendered next to the per-contact total in the breakdown rows.
///
///   • "settled" — green checkmark + "Settled". The debtor
///                 claimed paid and the payer confirmed it.
///   • "pending" — neutral "Paid" pill. The debtor claimed paid
///                 but the payer hasn't confirmed yet.
///   • "owes"    — nothing. The default state shouldn't add
///                 visual noise to a row that just shows a total.
///
/// Read-only / advisory: this chip never offers an action. The
/// claim affordance lives in the Pay bar; confirmation has no web
/// surface at all.
export function SettlementChip(props: { state: SettlementState }) {
  return (
    <Show when={props.state !== "owes"}>
      <Show
        when={props.state === "settled"}
        fallback={
          <span class="inline-flex items-center px-1.5 py-0.5 rounded-full bg-ios-card-hi text-ios-caption2 text-ios-label-secondary leading-none">
            Paid
          </span>
        }
      >
        <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-ios-card-hi text-ios-caption2 text-ios-green leading-none">
          <CheckmarkGlyph size={9} />
          Settled
        </span>
      </Show>
    </Show>
  );
}
