import type { JSX } from "solid-js";
import { initialsFor } from "../lib/format";

/// Circular avatar. Render paths in priority order:
///
///   1. `variant="everyone"` → `person.3.fill` SF Symbol —
///      indicates an item is assigned to every selected contact.
///   2. `displayText` non-empty → render the literal text
///      centered (e.g., a count like "2" for items assigned to
///      a partial subset of contacts; matches iOS's
///      `InitialsAvatar(text: "\(count)")` path).
///   3. `imageURL` present → photo.
///   4. `fullName` non-empty → two-letter initials.
///   5. Otherwise → `person.fill` silhouette fallback (or an
///      empty gray circle when `emptyWhenUnnamed` is set).
///
/// Path data for the SF Symbol variants comes verbatim from
/// Apple's CoreSVG export so the glyph matches the iOS app
/// pixel-for-pixel.
export interface AvatarProps {
  size: number;
  fullName?: string | null;
  /// Optional source (URL or data: URI). Web doesn't have
  /// access to iOS contact-card photos directly — we'd source
  /// these from a future avatar-upload flow if/when added.
  imageURL?: string | null;
  /// Override for the everyone-assigned indicator. Renders the
  /// person.3.fill SF Symbol on iOS; here we use the same
  /// glyph as an inline SVG.
  variant?: "everyone";
  /// Literal text to render in the avatar (centered, same
  /// typography as the initials path). Mirrors iOS's
  /// `InitialsAvatar(text:)` constructor — used by ItemRow to
  /// show an assignment count ("2", "3") when an item is
  /// assigned to a partial subset of the selected contacts
  /// (more than one, but fewer than all). Takes priority over
  /// `imageURL` / `fullName` / fallbacks; only `variant`
  /// overrides it.
  displayText?: string | null;
  /// When true, an avatar with no image and no name renders as
  /// an EMPTY gray circle (no `person.fill` silhouette inside).
  /// iOS's ItemRow uses this for unassigned items — a flat
  /// pill, not a glyph — so the row reads "this has no
  /// assignees" without competing visually with assigned rows
  /// that show a real face. Default `false` preserves the
  /// `person.fill` fallback for everywhere else.
  emptyWhenUnnamed?: boolean;
  class?: string;
  style?: JSX.CSSProperties;
}

export function Avatar(props: AvatarProps) {
  // `props.size` is read INLINE inside the JSX `style` object
  // below — that's a Solid-reactive context, so the values
  // re-evaluate on prop changes and the DOM style updates.
  // The previous version of this file did `const dim = \`${props.size}px\``
  // outside the JSX, which only ran once at component mount
  // and froze the avatar at whatever size it had on first
  // render. Result: when a contact toggled active / inactive
  // in `ContactsRow`, the Avatar's inner div would NOT resize,
  // even though the outer span (which inlines size correctly)
  // did — so you'd see a 44pt avatar inside a 56pt outer
  // slot, or vice versa. Don't reintroduce the local-const
  // pattern here.
  const hasName = () => {
    const n = props.fullName?.trim();
    return !!n;
  };
  const hasDisplayText = () => {
    const t = props.displayText?.trim();
    return !!t;
  };
  // Empty-state detection — mirrors the iOS
  // `ItemRow.swift::assignmentIndicator` empty branch:
  // when there's no contact / image / text / glyph variant
  // to render AND the call-site opted into the empty form
  // via `emptyWhenUnnamed`, the circle should use the
  // LIGHTER fill (`Color.gray.opacity(0.2)` on iOS) so it
  // reads as "no assignee" against the more solid 0.5α
  // fills used for assigned states, the everyone-chip, and
  // initials avatars.
  const isEmpty = () =>
    props.variant !== "everyone" &&
    !hasDisplayText() &&
    !props.imageURL &&
    !hasName() &&
    !!props.emptyWhenUnnamed;
  return (
    <div
      // iOS `ContactAvatar` uses `.foregroundStyle(.white)` —
      // a LITERAL `Color.white`, not a system label token — for
      // both the initials text and the `person.fill` /
      // `person.3.fill` glyph fallbacks. The previous `text-
      // ios-label` mapping happened to render white in dark
      // mode (where `--ios-label` is `#ffffff`) but rendered
      // BLACK in light mode (where `--ios-label` is
      // `#000000`), which was wrong on every avatar surface
      // because the gray-fill circle stays dark enough that
      // black text barely registers. Use a hardcoded `text-
      // white` so initials and SF glyphs stay white in both
      // modes, matching iOS's literal `Color.white`.
      class={`shrink-0 rounded-full ${isEmpty() ? "bg-ios-gray-fill-dim" : "bg-ios-gray-fill"} flex items-center justify-center overflow-hidden text-white font-semibold ${props.class ?? ""}`}
      style={{
        width: `${props.size}px`,
        height: `${props.size}px`,
        "font-size": `${Math.round(props.size * 0.4)}px`,
        // Smooth size-change animation when `props.size`
        // flips (e.g. ContactsRow's 44 ↔ 56 active toggle).
        // Replaces the View-Transitions-driven FLIP we used
        // to do — the new approach keeps the bottom-bar
        // scrim's `backdrop-filter` working throughout the
        // animation, which the View Transition snapshot
        // would otherwise drop.
        transition:
          "width 450ms cubic-bezier(0.32, 0.72, 0, 1), height 450ms cubic-bezier(0.32, 0.72, 0, 1), font-size 450ms cubic-bezier(0.32, 0.72, 0, 1)",
        ...props.style,
      }}
    >
      {props.variant === "everyone" ? (
        // iOS sizing reference (`Splitea/Views/BillSplit/Components/ItemRow.swift`):
        //   Image(systemName: "person.3.fill")
        //     .font(.system(size: 40 * 0.4))
        //     .frame(width: 40, height: 40)
        //     .clipShape(Circle())
        // i.e. the SF Symbol's font-size is 40% of the circle
        // diameter. We match the same multiplier here against
        // the SVG's rendered height — for `person.3.fill` the
        // wider 1.82:1 aspect ratio is honored inside
        // PersonThreeFillGlyph itself (width derived from height).
        <PersonThreeFillGlyph size={Math.round(props.size * 0.4)} />
      ) : hasDisplayText() ? (
        // Literal text override (e.g. assignment count). Same
        // typography as the initials path so the visual rhythm
        // is consistent across rows that show a name vs ones
        // that show "2" / "3". Renders BEFORE the image / name
        // / fallback paths because the call-site is asserting
        // it wants this exact text shown.
        <span>{props.displayText!.trim()}</span>
      ) : props.imageURL ? (
        <img
          src={props.imageURL}
          alt={props.fullName ?? ""}
          width={props.size}
          height={props.size}
          class="block w-full h-full object-cover"
        />
      ) : hasName() ? (
        <span>{initialsFor(props.fullName)}</span>
      ) : props.emptyWhenUnnamed ? (
        // Empty gray circle — used by ItemRow for unassigned
        // items. The screenshot from iOS shows the same flat
        // pill (no silhouette) for items with zero assignees.
        null
      ) : (
        // Same iOS reference: `person.fill` rendered at a font
        // size of `diameter × 0.4`. See ContactAvatar.swift's
        // `systemImage: "person.fill"` default fallback.
        <PersonFillGlyph size={Math.round(props.size * 0.4)} />
      )}
    </div>
  );
}

/// SF Symbol `person.3.fill` (three silhouettes) — natural
/// viewBox 88.6875 × 48.6797 (landscape ~1.82:1). Honors the
/// natural aspect ratio: caller passes the desired height, we
/// derive width from the ratio.
function PersonThreeFillGlyph(props: { size: number }) {
  const ratio = 88.6875 / 48.6797;
  const width = () => props.size * ratio;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 88.6875 48.6797"
      width={width()}
      height={props.size}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M27.3494 30.788C23.4537 34.1718 21.2578 38.4953 21.2578 42.375C21.2578 43.5147 21.5386 44.578 22.0765 45.4922L4.125 45.4922C1.14844 45.4922 0 44.3203 0 42.2109C0 35.7188 6.60938 27.9141 17.1797 27.9141C21.1888 27.9141 24.6282 29.0368 27.3494 30.788ZM25.3359 15.3047C25.3359 20.3906 21.5625 24.3281 17.1797 24.3281C12.8203 24.3281 9.02344 20.3906 9.02344 15.3516C9.02344 10.3594 12.8438 6.53906 17.1797 6.53906C21.5391 6.53906 25.3359 10.2656 25.3359 15.3047Z" />
      <path d="M88.3359 42.2109C88.3359 44.3203 87.1875 45.4922 84.2109 45.4922L66.2879 45.4922C66.8232 44.578 67.1016 43.5147 67.1016 42.375C67.1016 38.4924 64.9082 34.1655 61.0105 30.7804C63.7297 29.0337 67.1672 27.9141 71.1797 27.9141C81.75 27.9141 88.3359 35.7188 88.3359 42.2109ZM79.3359 15.3047C79.3359 20.3906 75.5625 24.3281 71.1797 24.3281C66.8203 24.3281 63 20.3906 63 15.3516C63 10.3594 66.8203 6.53906 71.1797 6.53906C75.5391 6.53906 79.3359 10.2656 79.3359 15.3047Z" />
      <path d="M44.2031 23.7891C49.2188 23.7891 53.5781 19.2891 53.5781 13.4297C53.5781 7.64062 49.2188 3.35156 44.2031 3.35156C39.1875 3.35156 34.8281 7.73438 34.8281 13.4766C34.8281 19.2891 39.1641 23.7891 44.2031 23.7891ZM28.4531 45.4922L59.9062 45.4922C62.4141 45.4922 63.9141 44.3203 63.9141 42.375C63.9141 36.3281 56.3438 27.9844 44.1797 27.9844C32.0391 27.9844 24.4688 36.3281 24.4688 42.375C24.4688 44.3203 25.9688 45.4922 28.4531 45.4922Z" />
    </svg>
  );
}

/// SF Symbol `person.fill` (single silhouette) — natural
/// viewBox 39.7969 × 42.1641 (slight portrait ~0.94:1). Used
/// when an avatar slot has no name and no photo (e.g. an item
/// row with no primary assignee).
function PersonFillGlyph(props: { size: number }) {
  const ratio = 39.7969 / 42.1641;
  const width = () => props.size * ratio;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 39.7969 42.1641"
      width={width()}
      height={props.size}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M4.00781 42.1406L35.4375 42.1406C37.9453 42.1406 39.4453 40.9688 39.4453 39.0234C39.4453 32.9766 31.875 24.6328 19.7109 24.6328C7.57031 24.6328 0 32.9766 0 39.0234C0 40.9688 1.5 42.1406 4.00781 42.1406ZM19.7344 20.4375C24.75 20.4375 29.1094 15.9375 29.1094 10.0781C29.1094 4.28906 24.75 0 19.7344 0C14.7188 0 10.3594 4.38281 10.3594 10.125C10.3594 15.9375 14.6953 20.4375 19.7344 20.4375Z" />
    </svg>
  );
}
