import { useParams } from "@solidjs/router";

/// Day-1 placeholder. Day 2 wires the snapshot fetch and the
/// receipt-info / items / contacts / summary sections. The
/// `shareID` route param drives every subsequent fetch.
export function ItemsView() {
  const params = useParams<{ shareID: string }>();
  return (
    <div class="min-h-dvh flex flex-col items-center justify-center p-6 text-center">
      <h1 class="text-ios-title-2 mb-2">Splitea</h1>
      <p class="text-ios-label-secondary text-ios-body">
        Loading share <code class="text-ios-blue">{params.shareID}</code>...
      </p>
    </div>
  );
}
