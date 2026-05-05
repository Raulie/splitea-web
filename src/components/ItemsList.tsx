import { createEffect, createSignal, For, onCleanup, Show } from "solid-js";
import type { ItemPayload, ContactPayload } from "../types/snapshot";
import { Avatar } from "./Avatar";
import { EVERYONE_ID } from "./ContactsRow";
import { formatCurrency, formatTaxRate } from "../lib/format";

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
          Items
        </h2>
      </div>
      <ul class="bg-ios-card rounded-ios-card divide-y divide-ios-separator overflow-hidden">
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
  onTap: () => void;
}

function ItemRow(props: ItemRowProps) {
  /// Per-row assignment indicator — mirrors the iOS cascade
  /// in `Components/ItemRow.swift::assignmentIndicator`:
  ///
  ///   • 0 assigned        → empty gray circle (no glyph).
  ///   • 1 assigned        → that contact's avatar.
  ///   • all assigned      → `person.3.fill` (everyone).
  ///   • else (1 < N < all)→ count text ("2", "3", ...).
  ///
  /// The previous web implementation collapsed cases 3 and 4
  /// into "show the first assignee's initials" — accurate
  /// only when N === 1, misleading for partial multi-assigns
  /// because the user couldn't tell a single-assignee row
  /// apart from a 3-of-5 row. The count-text variant restores
  /// the at-a-glance signal.
  const isEveryone = () =>
    props.totalContactCount > 1 &&
    props.assigned.length === props.totalContactCount;
  const isPartial = () =>
    props.assigned.length > 1 &&
    props.assigned.length < props.totalContactCount;
  /// First assignee for the single-assignee path.
  const primary = () => props.assigned[0] ?? null;

  /// Bouncy scale on assignment-count change, mirroring the
  /// iOS `BounceState` enum in `Components/ItemRow.swift`:
  ///   • added   → scale 1.25 (overshoot)
  ///   • removed → scale 0.75 (depress)
  ///   • idle    → scale 1.0 after 200ms
  /// iOS uses `spring(duration: 0.25, bounce: 0.7)`. CSS
  /// doesn't have a real spring; the closest match is a
  /// `cubic-bezier` whose final control point overshoots 1
  /// (here `(0.5, 1.6, 0.5, 1)` — a pronounced "back-out"
  /// that feels springy at 250ms).
  const [scale, setScale] = createSignal(1);
  let prevCount = props.assigned.length;
  let revertTimer: ReturnType<typeof setTimeout> | null = null;
  createEffect(() => {
    const current = props.assigned.length;
    if (current === prevCount) return;
    setScale(current > prevCount ? 1.25 : 0.75);
    prevCount = current;
    if (revertTimer !== null) clearTimeout(revertTimer);
    revertTimer = setTimeout(() => {
      setScale(1);
      revertTimer = null;
    }, 200);
  });
  onCleanup(() => {
    if (revertTimer !== null) clearTimeout(revertTimer);
  });

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
        <span
          class="inline-flex"
          style={{
            transform: `scale(${scale()})`,
            transition:
              "transform 250ms cubic-bezier(0.5, 1.6, 0.5, 1)",
          }}
        >
          {/* Cascade matches iOS — see `isEveryone` /
              `isPartial` derivation above. Order of checks:
              everyone → partial-count → single primary
              (which itself renders empty when no assignee). */}
          <Show
            when={!isEveryone()}
            fallback={<Avatar size={40} variant="everyone" />}
          >
            <Show
              when={!isPartial()}
              fallback={
                <Avatar
                  size={40}
                  displayText={String(props.assigned.length)}
                />
              }
            >
              <Avatar
                size={40}
                fullName={primary()?.fullName ?? null}
                emptyWhenUnnamed={!primary()}
              />
            </Show>
          </Show>
        </span>
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
          <Show when={props.item.tax !== null && props.item.tax !== undefined && props.item.tax > 0}>
            <span class="text-ios-caption2 text-ios-label-secondary">
              {formatTaxRate(props.item.tax!)}
            </span>
          </Show>
        </div>
      </button>
    </li>
  );
}
