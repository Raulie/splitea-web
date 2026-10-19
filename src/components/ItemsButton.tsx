import { ChecklistGlyph } from "./ChecklistGlyph";

export function ItemsButton(props: { onClick: () => void; ariaLabel: string }) {
  return (
    <button
      type="button"
      class="ios-glass-button shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-ios-label active:opacity-60 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ios-blue"
      aria-label={props.ariaLabel}
      onClick={() => props.onClick()}
    >
      <ChecklistGlyph size={18} class="rtl-mirror" />
    </button>
  );
}
