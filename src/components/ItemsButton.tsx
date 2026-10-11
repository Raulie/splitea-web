import { ChecklistGlyph } from "./ChecklistGlyph";

export function ItemsButton(props: { onClick: () => void; ariaLabel: string }) {
  return (
    <button
      type="button"
      class="shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-ios-label active:opacity-60 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ios-blue"
      style={{
        background: "var(--ios-toast-bg)",
        "backdrop-filter": "blur(20px) saturate(180%)",
        "-webkit-backdrop-filter": "blur(20px) saturate(180%)",
        "box-shadow": "inset 0 0 0 1px var(--ios-toast-border), 0 4px 16px rgba(0, 0, 0, 0.18)",
      }}
      aria-label={props.ariaLabel}
      onClick={() => props.onClick()}
    >
      <ChecklistGlyph size={18} />
    </button>
  );
}
