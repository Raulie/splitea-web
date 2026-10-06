import { For } from "solid-js";

export interface SegmentedControlProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}

export function SegmentedControl<T extends string>(props: SegmentedControlProps<T>) {
  const index = () => Math.max(0, props.options.findIndex((o) => o.value === props.value));
  return (
    <div
      role="group"
      aria-label={props.ariaLabel}
      class="relative flex h-8 rounded-full p-0.5"
      style={{ background: "rgb(28, 28, 31)" }}
    >
      <div
        aria-hidden="true"
        class="segmented-thumb absolute top-0.5 bottom-0.5 left-0.5 rounded-full"
        style={{
          width: `calc((100% - 4px) / ${props.options.length})`,
          transform: `translateX(${index() * 100}%)`,
          background: "rgb(90, 90, 95)",
        }}
      />
      <For each={props.options}>
        {(option) => (
          <button
            type="button"
            aria-pressed={option.value === props.value}
            class="relative flex-1 min-w-0 truncate rounded-full px-2 text-[13px] leading-[18px] font-semibold text-ios-label"
            onClick={() => props.onChange(option.value)}
          >
            {option.label}
          </button>
        )}
      </For>
    </div>
  );
}
