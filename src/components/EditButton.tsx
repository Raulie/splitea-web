import { PencilGlyph } from "./PencilGlyph";

/// iOS 26-style circular edit button. Mirrors `BackButton`'s
/// shape (44×44pt circle with the `ios-card` lifted-dark
/// background) so the leading and trailing slots of the nav
/// bar feel like a matched pair. Used on `SavedReceiptView`'s
/// nav bar when the breakdown is the entry view (because all
/// items were already assigned at first paint) — tapping it
/// reveals `ItemsView` so the user can edit assignments.
export interface EditButtonProps {
  onClick: () => void;
  /// Optional accessibility override; defaults to "Edit
  /// items".
  ariaLabel?: string;
}

export function EditButton(props: EditButtonProps) {
  return (
    <button
      type="button"
      class="w-11 h-11 rounded-full bg-ios-card flex items-center justify-center text-ios-label active:opacity-60 transition-opacity"
      aria-label={props.ariaLabel ?? "Edit items"}
      onClick={() => props.onClick()}
    >
      <PencilGlyph size={17} />
    </button>
  );
}
