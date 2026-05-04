import { For, Show } from "solid-js";
import type { ItemPayload, ContactPayload } from "../types/snapshot";
import { Avatar } from "./Avatar";
import { formatCurrency, formatTaxRate } from "../lib/format";

/// Items section header ("Items" + "Reset" right-aligned) plus
/// the rounded-card list of items. Each row shows the assigned
/// avatar (or a "everyone" pill if assigned to all selected
/// contacts), the item description, and price + tax rate.
///
/// Read-only in Day 2 — taps don't toggle assignments yet.
/// That wires up in Day 3 (WebSocket-driven mutations).
export interface ItemsListProps {
  items: ItemPayload[];
  /// Map from itemId to the list of contacts assigned. The
  /// snapshot ships assignments as a flat array; the parent
  /// computes this map once for fast lookup.
  assignmentsByItem: Map<string, ContactPayload[]>;
  totalContactCount: number;
  currencyCode: string;
  onReset?: () => void;
}

export function ItemsList(props: ItemsListProps) {
  return (
    <section>
      <div class="flex items-center justify-between px-4 mb-2">
        <h2 class="text-ios-title-3 text-ios-label">Items</h2>
        <button
          type="button"
          class="text-ios-body text-ios-blue active:opacity-60 transition-opacity"
          onClick={() => props.onReset?.()}
        >
          Reset
        </button>
      </div>
      <ul class="bg-ios-card rounded-ios-card divide-y divide-ios-separator overflow-hidden">
        <For each={props.items}>
          {(item) => (
            <ItemRow
              item={item}
              assigned={props.assignmentsByItem.get(item.id) ?? []}
              totalContactCount={props.totalContactCount}
              currencyCode={props.currencyCode}
            />
          )}
        </For>
      </ul>
    </section>
  );
}

interface ItemRowProps {
  item: ItemPayload;
  assigned: ContactPayload[];
  totalContactCount: number;
  currencyCode: string;
}

function ItemRow(props: ItemRowProps) {
  /// "Everyone" indicator when the item is assigned to every
  /// selected contact AND there's more than one. Matches the
  /// iOS people.fill avatar variant for shared items.
  const isEveryone = () =>
    props.totalContactCount > 1 &&
    props.assigned.length === props.totalContactCount;
  /// First assignee for the avatar slot. Multi-assignee items
  /// without "everyone" status also show one face — the iOS
  /// behavior; multi-person feedback comes from the bottom
  /// contacts row, not the per-item avatar.
  const primary = () => props.assigned[0] ?? null;
  return (
    <li class="px-4 py-3 flex items-center gap-3">
      <Show
        when={!isEveryone()}
        fallback={<Avatar size={36} variant="everyone" />}
      >
        <Avatar size={36} fullName={primary()?.fullName ?? null} />
      </Show>
      <div class="flex-1 min-w-0">
        <div class="text-ios-body text-ios-label-secondary truncate">
          {props.item.itemDescription}
        </div>
      </div>
      <div class="flex flex-col items-end">
        <span class="text-ios-body font-medium text-ios-label">
          {formatCurrency(props.item.price, props.currencyCode)}
        </span>
        <Show when={props.item.tax !== null && props.item.tax !== undefined && props.item.tax > 0}>
          <span class="text-ios-caption text-ios-label-secondary">
            {formatTaxRate(props.item.tax!)}
          </span>
        </Show>
      </div>
    </li>
  );
}
