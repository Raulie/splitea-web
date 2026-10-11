import { For, Show } from "solid-js";
import type { ItemPayload, ContactPayload } from "../types/snapshot";
import { AssigneeIndicator } from "./AssigneeIndicator";
import { EVERYONE_ID } from "./ContactsRow";
import { formatCurrency, formatTaxRate } from "../lib/format";
import { uniformItemRate } from "../lib/moneyMath";
import { t } from "../lib/i18n";

/// Items section header plus the rounded-card list of items. Mirrors
/// `ItemsView.itemsSection` and `Components/ItemRow.swift` on iOS.
///
/// Tapping a row toggles the assignment of that item against
/// `activeContactId` — the contact currently selected in
/// `ContactsRow`. The toggle wraps `assignment.add` /
/// `assignment.remove` mutation ops; the parent applies them
/// optimistically and broadcasts via the live socket.
export interface ItemsListProps {
  items: ItemPayload[];
  /// Map from itemId to the list of contacts assigned. The
  /// snapshot ships assignments as a flat array; the parent
  /// computes this map once for fast lookup.
  assignmentsByItem: Map<string, ContactPayload[]>;
  totalContactCount: number;
  currencyCode: string;
  receiptTaxRate: number | null;
  taxInclusive: boolean;
  /// The contact a tap will toggle the assignment against.
  /// `null` when no contact is selected — taps no-op in that
  /// case (and we drop the visual affordance accordingly).
  activeContactId: string | null;
  onToggleItem: (itemId: string) => void;
  readOnly?: boolean;
}

export function ItemsList(props: ItemsListProps) {
  const showsTaxRate = () =>
    !props.taxInclusive &&
    (props.receiptTaxRate === null || props.receiptTaxRate === undefined) &&
    uniformItemRate(props.items) === null;
  return (
    <section>
      <div class="flex items-center justify-between px-4 mb-[9px]">
        <h2 class="text-ios-headline text-ios-label-secondary">
          {t("itemsSectionTitle")}
        </h2>
      </div>
      <ul class="items-card bg-ios-card rounded-ios-card overflow-hidden">
        <For each={props.items}>
          {(item, index) => {
            const assigned = () =>
              props.assignmentsByItem.get(item.id) ?? [];
            // When the active selection is "Everyone", an item
            // is considered "assigned to active" only when
            // every contact is on it — same rule the iOS app
            // uses to decide whether the row should highlight.
            const isAssignedToActive = () => {
              if (props.activeContactId === EVERYONE_ID) {
                return (
                  props.totalContactCount > 0 &&
                  assigned().length === props.totalContactCount
                );
              }
              return (
                props.activeContactId !== null &&
                assigned().some((c) => c.id === props.activeContactId)
              );
            };
            return (
              <ItemRow
                item={item}
                assigned={assigned()}
                totalContactCount={props.totalContactCount}
                currencyCode={props.currencyCode}
                isAssignedToActive={isAssignedToActive()}
                tappable={!props.readOnly && props.activeContactId !== null}
                readOnly={props.readOnly ?? false}
                showsTaxRate={showsTaxRate()}
                showsDivider={index() < props.items.length - 1}
                onTap={() => props.onToggleItem(item.id)}
              />
            );
          }}
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
  isAssignedToActive: boolean;
  /// True when there's a contact selected (so taps mean
  /// something). When false the row is still rendered but
  /// taps are no-ops — same UX as iOS.
  tappable: boolean;
  showsTaxRate: boolean;
  showsDivider: boolean;
  readOnly: boolean;
  onTap: () => void;
}

function ItemRow(props: ItemRowProps) {
  const hasTax = () =>
    props.showsTaxRate &&
    props.item.tax !== null &&
    props.item.tax !== undefined &&
    props.item.tax > 0;
  const rowClass = "w-full text-left px-4 py-[15px] flex items-center gap-3";
  const content = () => (
    <>
      <AssigneeIndicator
        assigned={props.assigned}
        total={props.totalContactCount}
        size={40}
      />
      <div
        class="flex-1 min-w-0 text-ios-subheadline line-clamp-2 break-words"
        classList={{
          "font-medium text-ios-label": props.isAssignedToActive,
          "text-ios-label-secondary": !props.isAssignedToActive,
        }}
      >
        {props.item.itemDescription}
      </div>
      <div class="shrink-0 flex flex-col items-end gap-1">
        <span
          class="text-[15px] leading-[18px] whitespace-nowrap"
          classList={{
            "font-bold text-ios-label": props.isAssignedToActive,
            "font-semibold text-ios-label-secondary": !props.isAssignedToActive,
          }}
        >
          {formatCurrency(props.item.price, props.currencyCode)}
        </span>
        <Show when={hasTax()}>
          <span class="px-[7px] py-[3px] rounded-full bg-ios-tertiary-fill text-[10px] leading-[12px] text-ios-label-secondary whitespace-nowrap">
            {formatTaxRate(props.item.tax!)}
          </span>
        </Show>
      </div>
    </>
  );
  return (
    <li class="relative">
      <Show when={!props.readOnly} fallback={<div class={rowClass}>{content()}</div>}>
        <button
          type="button"
          class={`${rowClass} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ios-blue`}
          onClick={() => props.onTap()}
          disabled={!props.tappable}
          aria-pressed={props.tappable ? props.isAssignedToActive : undefined}
        >
          {content()}
        </button>
      </Show>
      <Show when={props.showsDivider}>
        <div aria-hidden="true" class="pointer-events-none absolute bottom-0 left-4 right-4 h-px bg-ios-separator" />
      </Show>
    </li>
  );
}
