import { For, Show } from "solid-js";
import type { ContactPayload } from "../types/snapshot";
import type { ContactItemShare } from "../lib/moneyMath";
import { Avatar } from "./Avatar";
import { ChevronGlyph } from "./ChevronGlyph";
import { DisclosureGroup } from "./DisclosureGroup";
import { formatCurrency, formatPhoneNumber } from "../lib/format";

/// Single contact's row on the post-split summary screen.
/// Mirrors `Splitea/Views/BillSplit/Components/ContactBreakdownRow.swift`
/// pixel-for-pixel — header layout, chevron behavior, dividers,
/// and the per-item `÷N` capsule pill all come straight from
/// the iOS implementation.
///
/// Header (collapsed):
///   `[avatar 36] [name + phone]    [💳? amount] [chevron→]`
///   Chevron rotates 90° (points down) when expanded.
///
/// Body (expanded):
///   `<solid Divider>`                     ← `Divider()` after header
///   item rows (NO dividers between)       ← VStack(spacing: 6)
///   `<dashed DashedDivider>`              ← before totals
///   Subtotal / Tax / Tip rows             ← summaryRow(.caption)
///
/// Per-item rows: `[description] [÷N capsule?]   [amount]`.
/// The `÷N` indicator only renders when `splitCount > 1` and
/// uses iOS's `tertiarySystemBackground` (our `ios-card-hi`)
/// fill in a `Capsule()` shape.
export interface ContactBreakdownRowProps {
  contact: ContactPayload;
  amount: number;
  isPayer: boolean;
  currencyCode: string;
  /// Per-item shares for this contact — same shape iOS's
  /// `BillSplitContactItemBreakdown` uses.
  items: ContactItemShare[];
  subtotal: number;
  tax: number;
  tip: number;
  /// When provided, overrides the disclosure's internal state.
  /// `SavedReceiptView`'s "Expand" header button uses this to
  /// flip every row open/closed in lockstep.
  open?: boolean;
  onOpenChange?: (next: boolean) => void;
}

export function ContactBreakdownRow(props: ContactBreakdownRowProps) {
  return (
    <DisclosureGroup
      open={props.open}
      onOpenChange={props.onOpenChange}
      // 18px summary padding (vs the previous 16h/12v) so
      // the 36px-radius avatar (size 36, r = 18) sits
      // concentric with the 36px card corner. Math:
      // avatar's center lands at (18 + 18, 18 + 18) =
      // (36, 36) from the card's top-left, which IS the
      // card's corner-curve center, so the gap from the
      // avatar's edge to the card's curve is a uniform
      // 18px around the visible arc — same SwiftUI
      // `ConcentricRectangle` rule (`outer = inner +
      // spacing`) applied to a circle inside a rounded
      // rect rather than a rounded rect inside a rounded
      // rect.
      summaryClass="p-[18px]"
      summary={(isOpen) => (
        <div class="flex items-center gap-3">
          <Avatar
            size={36}
            fullName={props.contact.fullName}
            imageURL={props.contact.avatarUrl}
          />
          <div class="flex-1 min-w-0">
            {/* iOS `ContactBreakdownRow.swift:78-79`:
                  Text(displayName)
                    .font(.subheadline).fontWeight(.semibold)
                Phone (line 84): .font(.caption) .secondary */}
            <div class="text-ios-subheadline font-semibold text-ios-label truncate">
              {props.contact.fullName ?? "Contact"}
            </div>
            <Show when={props.contact.phoneNumber}>
              <div class="text-ios-caption text-ios-label-secondary truncate">
                {formatPhoneNumber(props.contact.phoneNumber)}
              </div>
            </Show>
          </div>
          <div class="flex items-center gap-1.5">
            <Show when={props.isPayer}>
              <CreditCardGlyph size={12} />
            </Show>
            {/* iOS amount: .subheadline.semibold (line 99-100). */}
            <span class="text-ios-subheadline font-semibold text-ios-label">
              {formatCurrency(props.amount, props.currencyCode)}
            </span>
          </div>
          {/* SF Symbol `chevron.left` exported from Apple's
              CoreSVG — same glyph the back button uses, just
              rotated 180° (collapsed → points right) or 270°
              (expanded → points down). iOS uses
              `chevron.right` rotated 90° on expand for the
              same effect; reusing one source SVG keeps the
              chevron weight identical across the app.
              Wrapped in a span so we apply the rotation
              transform via inline style and let CSS
              transition it without fighting the SVG's own
              rotation prop. */}
          <span
            class="text-ios-label-tertiary shrink-0 inline-flex"
            // `isOpen` is a SIGNAL GETTER — calling it inside
            // this style object turns into a reactive binding
            // that only updates the `transform` string. The
            // CSS `transition` then animates the rotation
            // smoothly between 180° (right) and 270° (down).
            // If we read `isOpen()` outside the style object
            // (e.g. in a const above), Solid would tear the
            // span down on every toggle and the transition
            // wouldn't fire — same bug we hit before this
            // refactor.
            style={{
              transform: `rotate(${isOpen() ? 270 : 180}deg)`,
              transition: "transform 280ms cubic-bezier(0.32, 0.72, 0, 1)",
            }}
            aria-hidden="true"
          >
            <ChevronGlyph size={11} />
          </span>
        </div>
      )}
    >
      <div class="px-4 pb-4">
        {/* Solid divider between the header and the items
            list — iOS `Divider()` with vertical padding 4. */}
        <div class="border-t border-ios-separator mt-1 mb-3" />

        {/* Per-item shares — VStack(spacing: 6) on iOS, NO
            dividers between rows. */}
        <ul class="space-y-1.5">
          <For each={props.items}>
            {(share) => (
              <li class="flex items-center gap-2 text-ios-caption text-ios-label-secondary">
                <span class="truncate">{share.description}</span>
                <Show when={share.splitCount > 1}>
                  {/* iOS `÷N` capsule: `Capsule().fill(Color
                      (.tertiarySystemBackground))` with
                      `.caption2` text. Padding 6h/2v. */}
                  <span class="px-1.5 py-0.5 rounded-full bg-ios-card-hi text-[11px] leading-none">
                    ÷{share.splitCount}
                  </span>
                </Show>
                {/* Amount inherits the row's
                    `text-ios-label-secondary` color rather
                    than overriding to `text-ios-label` —
                    iOS renders both the description and the
                    per-item amount in `.foregroundStyle
                    (.secondary)` for visual hierarchy
                    against the bolder header total above. */}
                <span class="ml-auto">
                  {formatCurrency(share.amount, props.currencyCode)}
                </span>
              </li>
            )}
          </For>
        </ul>

        {/* Dashed divider between items and totals — iOS
            `DashedDivider()` with vertical padding 4. CSS
            `border-style: dashed` on a 1px-tall block; the
            color matches the solid-divider token so both
            stack visually-paired. */}
        <div
          class="my-3 border-t border-dashed border-ios-separator"
          aria-hidden="true"
        />

        {/* Subtotal / Tax / Tip — iOS `summaryRow(isBold:
            false)`. Hidden when zero, matching the SwiftUI
            `if subtotal > 0` guards. */}
        <div class="space-y-1">
          <Show when={props.subtotal > 0}>
            <BreakdownLine
              label="Subtotal"
              value={formatCurrency(props.subtotal, props.currencyCode)}
            />
          </Show>
          <Show when={props.tax > 0}>
            <BreakdownLine
              label="Tax"
              value={formatCurrency(props.tax, props.currencyCode)}
            />
          </Show>
          <Show when={props.tip > 0}>
            <BreakdownLine
              label="Tip"
              value={formatCurrency(props.tip, props.currencyCode)}
            />
          </Show>
        </div>
      </div>
    </DisclosureGroup>
  );
}

function BreakdownLine(props: { label: string; value: string }) {
  return (
    <div class="flex items-center text-ios-caption text-ios-label-secondary">
      <span>{props.label}</span>
      <span class="ml-auto">{props.value}</span>
    </div>
  );
}

function CreditCardGlyph(props: { size: number }) {
  const width = () => (props.size * 12.041) / 8.34473;
  return (
    <svg
      viewBox="0 0 12.041 8.34473"
      width={width()}
      height={props.size}
      fill="currentColor"
      class="text-ios-blue"
      aria-hidden="true"
    >
      <path d="M1.99707 6.83105C1.70898 6.83105 1.51855 6.63574 1.51855 6.3623L1.51855 5.45898C1.51855 5.18066 1.70898 4.99023 1.99707 4.99023L3.19336 4.99023C3.48145 4.99023 3.67188 5.18066 3.67188 5.45898L3.67188 6.3623C3.67188 6.63574 3.48145 6.83105 3.19336 6.83105ZM0 3.08105L0 1.97266L11.4746 1.97266L11.4746 3.08105ZM1.5332 8.34473L9.94141 8.34473C10.9668 8.34473 11.4746 7.8418 11.4746 6.83594L11.4746 1.51855C11.4746 0.512695 10.9668 0.00488281 9.94141 0.00488281L1.5332 0.00488281C0.512695 0.00488281 0 0.512695 0 1.51855L0 6.83594C0 7.8418 0.512695 8.34473 1.5332 8.34473Z" />
    </svg>
  );
}
