import { For, Show } from "solid-js";
import type { ItemPayload, ContactPayload } from "../types/snapshot";
import { AssigneeIndicator } from "./AssigneeIndicator";
import { EVERYONE_ID } from "./ContactsRow";
import { formatCurrency, formatTaxRate } from "../lib/format";
import { uniformItemRate } from "../lib/moneyMath";
import { t } from "../lib/i18n";

/// Items section header ("Items" + "Reset" right-aligned) plus
/// the rounded-card list of items. Each row shows the assigned
/// avatar (or an "everyone" pill if assigned to all selected
/// contacts), the item description, and price + tax rate.
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
  /// The contact a tap will toggle the assignment against.
  /// `null` when no contact is selected — taps no-op in that
  /// case (and we drop the visual affordance accordingly).
  activeContactId: string | null;
  onToggleItem: (itemId: string) => void;
}

export function ItemsList(props: ItemsListProps) {
  // One uniform rate across all items → it shows once in the summary's
  // "Tax (X%)" row, so drop the redundant per-row badge. Mixed rates →
  // keep the badge so each row's own rate stays visible.
  const showsTaxRate = () => uniformItemRate(props.items) === null;
  return (
    <section>
      {/* "Items" header only — the Reset / "Split evenly"
          affordance from iOS lives on the owner side; web
          peers can only assign their own slice, so the
          destructive bulk control would be confusing here. */}
      {/* iOS section header treatment — sub-headline weight
          (15pt) at semibold in `text-ios-label-secondary`
          (~60% white). Matches the rendered Section header
          style SwiftUI uses for `.insetGrouped` lists on
          iOS 26 when the developer doesn't explicitly
          override font / color: a subdued gray label that
          reads as "category divider", not as primary
          content. The earlier `text-ios-body text-ios-label`
          (17pt white) read too prominent next to the items
          card below; the earlier `text-ios-footnote text-
          ios-label-secondary` (13pt gray) read too faint.
          15pt + semibold + gray is the sweet spot the iOS
          screenshot lands on. */}
      <div class="flex items-center justify-between px-4 mb-2">
        <h2 class="text-ios-subheadline font-semibold text-ios-label-secondary">
          {t("itemsSectionTitle")}
        </h2>
      </div>
      <ul class="bg-ios-card rounded-ios-card ios-list-divide overflow-hidden">
        <For each={props.items}>
          {(item) => {
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
                tappable={props.activeContactId !== null}
                showsTaxRate={showsTaxRate()}
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
  /// True when the active contact is one of the assignees on
  /// this item — drives the row's "this is mine" treatment
  /// (subtle bg tint to confirm the assignment).
  isAssignedToActive: boolean;
  /// True when there's a contact selected (so taps mean
  /// something). When false the row is still rendered but
  /// taps are no-ops — same UX as iOS.
  tappable: boolean;
  /// False when every item shares one tax rate — the per-row tax badge
  /// is dropped because the rate is shown once in the summary instead.
  showsTaxRate: boolean;
  onTap: () => void;
}

function ItemRow(props: ItemRowProps) {
  /// Per-row assignment indicator: a port of the iOS
  /// `AssignmentIndicator` in `Components/ItemRow.swift`
  /// (dashed empty slot, one avatar, an overlapping stack with a
  /// "+n" bubble past three, or the everyone glyph), including its
  /// springs. See `AssigneeIndicator.tsx`.
  return (
    <li>
      <button
        type="button"
        // `py-4` (16pt) matches the visual vertical inset
        // iOS InsetGroupedListStyle gives each row in
        // `Components/ItemRow.swift`. Combined with the 40pt
        // avatar, this lands rows at ~72pt total height —
        // the same vertical rhythm the iOS screenshot shows.
        // Earlier `py-3` (12pt) was 8pt shy on each row.
        class={`w-full text-left px-4 py-4 flex items-center gap-3 active:bg-ios-card-hi transition-colors ${
          props.isAssignedToActive ? "bg-ios-card-hi" : ""
        }`}
        onClick={() => props.onTap()}
        disabled={!props.tappable}
      >
        <AssigneeIndicator
          assigned={props.assigned}
          total={props.totalContactCount}
          size={40}
        />
        {/* Item description, price, and tax % all match iOS
            `Components/ItemRow.swift:146-164`:
              description: .subheadline (15pt) .secondary
              price:       .subheadline (15pt) .semibold .primary
              tax %:       .caption2     (11pt) .secondary
            We were one size larger across the board (body
            17pt instead of subheadline 15pt) which made the
            web rows visibly heavier than iOS.
            VStack(alignment: .trailing, spacing: 2) on the
            right side maps to Tailwind `space-y-0.5` (2pt). */}
        <div class="flex-1 min-w-0">
          <div class="text-ios-subheadline text-ios-label-secondary truncate">
            {props.item.itemDescription}
          </div>
        </div>
        <div class="flex flex-col items-end space-y-0.5">
          <span class="text-ios-subheadline font-semibold text-ios-label">
            {formatCurrency(props.item.price, props.currencyCode)}
          </span>
          <Show when={props.showsTaxRate && props.item.tax !== null && props.item.tax !== undefined && props.item.tax > 0}>
            <span class="text-ios-caption2 text-ios-label-secondary">
              {formatTaxRate(props.item.tax!)}
            </span>
          </Show>
        </div>
      </button>
    </li>
  );
}
