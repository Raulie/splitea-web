import { Show } from "solid-js";
import { formatReceiptDate, formatReceiptTime } from "../lib/format";

/// Receipt header card: merchant name on top, divider, then
/// "Date" label with date + time pills aligned right. Mirrors
/// the iOS `receiptInfoSection` block in `ItemsView.swift`.
export interface ReceiptInfoCardProps {
  merchantName: string | null;
  receiptDate: number | null;
}

export function ReceiptInfoCard(props: ReceiptInfoCardProps) {
  return (
    <section class="bg-ios-card rounded-ios-card overflow-hidden">
      <div class="px-4 py-4">
        <div class="text-ios-label text-ios-body font-medium">
          {props.merchantName ?? ""}
        </div>
      </div>
      <div class="border-t border-ios-separator" />
      <div class="px-4 py-3 flex items-center gap-2">
        <span class="text-ios-label text-ios-body">Date</span>
        <Show when={props.receiptDate}>
          {(date) => (
            <div class="ml-auto flex items-center gap-2">
              <span class="px-3 py-1.5 rounded-lg bg-ios-card-hi text-ios-callout">
                {formatReceiptDate(date())}
              </span>
              <span class="px-3 py-1.5 rounded-lg bg-ios-card-hi text-ios-callout">
                {formatReceiptTime(date())}
              </span>
            </div>
          )}
        </Show>
      </div>
    </section>
  );
}
