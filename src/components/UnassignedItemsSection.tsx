import { For } from "solid-js";
import type { ItemPayload } from "../types/snapshot";
import { formatCurrency } from "../lib/format";
import { WarningTriangleGlyph } from "./WarningTriangleGlyph";

/// Web port of iOS `UnassignedItemsSection`
/// (`Splitea/Views/BillSplit/Components/UnassignedItemsSection.swift`).
/// Surfaced on the breakdown view (`SavedReceiptView`) when one
/// or more items in the receipt have no contact assignment —
/// since their cost isn't being split anywhere, the user needs
/// a clear callout that the bill total they see in the summary
/// IS missing those amounts (or the unassigned amounts will
/// fall on the payer alone, depending on app semantics). The
/// yellow warning triangle next to the title mirrors the SF
/// Symbol `exclamationmark.triangle.fill` palette rendering
/// on iOS (black mark, yellow triangle).
export interface UnassignedItemsSectionProps {
  items: ItemPayload[];
  currencyCode: string;
}

export function UnassignedItemsSection(props: UnassignedItemsSectionProps) {
  return (
    <section class="space-y-2">
      {/* Header — title bold + warning icon, sits OUTSIDE the
          card so it reads as a section heading rather than a
          row inside the list. iOS uses `.title3` (20pt) bold. */}
      <div class="flex items-center px-2">
        <h2 class="text-ios-title-3 font-bold text-ios-label">
          Unassigned Items
        </h2>
        <span class="ml-auto">
          <WarningTriangleGlyph size={20} />
        </span>
      </div>
      {/* Card — items list. iOS rows: `.subheadline` (15pt)
          secondary on both description and price. Vertical
          padding 12pt matches iOS `.padding(.vertical, 12)`. */}
      <div class="bg-ios-card rounded-ios-card px-4 py-3 space-y-2">
        <For each={props.items}>
          {(item) => (
            <div class="flex items-center text-ios-subheadline text-ios-label-secondary">
              <span class="truncate">{item.itemDescription}</span>
              <span class="ml-auto">
                {formatCurrency(item.price, props.currencyCode)}
              </span>
            </div>
          )}
        </For>
      </div>
    </section>
  );
}
