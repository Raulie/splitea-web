import { createMemo, For, Show } from "solid-js";
import type { ContactPayload } from "../types/snapshot";
import { Avatar } from "./Avatar";
import { formatCurrency } from "../lib/format";

/// Sticky bottom contacts row. Mirrors the iOS `bottomBar`
/// block in `ItemsView.swift` including the visual rules the
/// iOS app applies to the active contact:
///
///   1. **The active contact is hoisted to position 0.** iOS
///      reorders `selectedContacts` so the currently-selected
///      contact (if not already first) is moved to index 0
///      before rendering. We do the same with a `createMemo`
///      that sorts the contacts array on every active change.
///
///   2. **The active contact renders larger** (avatar 64 vs 48
///      on iOS — we use a slightly more conservative 56 vs 44
///      for phone-sized web viewports) and surfaces its NAME +
///      RUNNING TOTAL to the right of the avatar. Inactive
///      contacts show just the bare avatar.
///
///   3. **The "Everyone" pill follows the same rules.** When
///      Everyone is active it sits at index 0, grows to the
///      active size, and renders the "Everyone" label; when
///      inactive it sits at the trailing edge as a compact
///      pill. We keep this scope-creep contained by allowing
///      `activeContactId` to be the literal string `"everyone"`
///      as a sentinel — the parent's tap handler reads it and
///      branches into bulk-assign behavior.
///
/// **No "Me" label on web.** iOS shows "Me" by checking
/// `contact.isUserContact` — flagged at create time for the
/// iOS owner. That signal identifies the SHARE OWNER, not
/// whoever opens the link in a browser. Without web Sign in
/// with Apple we have no reliable way to identify the viewer,
/// so labeling someone else's contact "Me" would be misleading.
/// Active contacts here always render their `fullName` (or a
/// "Contact" fallback). Reintroduce the "Me" branch when SIWA
/// lands and we can resolve the viewer's own contact id.
///
/// The "Add Contact" plus button from iOS is omitted: web
/// visitors don't mutate the contact list, only assignments.
export const EVERYONE_ID = "everyone";

export interface ContactsRowProps {
  contacts: ContactPayload[];
  /// Pre-computed total per contact. Parent owns the math.
  totalsByContact: Map<string, number>;
  currencyCode: string;
  /// PayerPhoneNumber from the snapshot — use to highlight the
  /// payer with the credit-card icon.
  payerPhoneNumber: string | null;
  /// Active selection. Either a contact id, the literal
  /// `EVERYONE_ID` sentinel, or null when nothing is selected.
  activeContactId: string | null;
  /// Called when the user taps a contact avatar or the
  /// Everyone pill to switch the active selection.
  onSelectContact: (id: string) => void;
}

const ACTIVE_AVATAR = 56;
const INACTIVE_AVATAR = 44;

export function ContactsRow(props: ContactsRowProps) {
  const isEveryoneActive = () => props.activeContactId === EVERYONE_ID;

  /// Reorder snapshot order → display order: active contact
  /// (if any) hoisted to index 0; everyone else in original
  /// order. Mirrors iOS `contactsList`'s `ids` computation.
  const orderedContacts = createMemo(() => {
    const list = [...props.contacts];
    const active = props.activeContactId;
    if (active && active !== EVERYONE_ID) {
      const idx = list.findIndex((c) => c.id === active);
      if (idx > 0) {
        const [c] = list.splice(idx, 1);
        list.unshift(c!);
      }
    }
    return list;
  });

  /// Match payer by phone-number suffix — same heuristic the
  /// iOS app uses (handles country-code / formatting drift).
  const isPayer = (contact: ContactPayload) => {
    if (!props.payerPhoneNumber) return false;
    const a = contact.phoneNumber.replace(/\D/g, "");
    const b = props.payerPhoneNumber.replace(/\D/g, "");
    if (!a || !b) return false;
    return a.endsWith(b) || b.endsWith(a);
  };

  /// Display label for the active contact. iOS shows
  /// `contact.givenName ?? contact.displayName` — i.e. the
  /// first name when available, falling back to the full
  /// display name. The snapshot doesn't ship the given /
  /// family split on the wire, so we extract the first
  /// space-separated token from `fullName`. Edge cases:
  ///   • Single-name contacts ("Liu") → "Liu" (the whole
  ///     fullName is the first name)
  ///   • Hyphenated first names ("Mary-Anne Smith") →
  ///     "Mary-Anne" (split is on whitespace, hyphen kept)
  ///   • `fullName === null` → "Contact" fallback
  const labelFor = (contact: ContactPayload) => {
    const name = contact.fullName?.trim();
    if (!name) return "Contact";
    const firstSpace = name.search(/\s/);
    return firstSpace === -1 ? name : name.slice(0, firstSpace);
  };

  /// Manual FLIP animation for the contact reorder. We
  /// previously used the View Transitions API for this, but
  /// it broke the bottom-bar scrim's `backdrop-filter` —
  /// Safari snapshots the page during the transition, and
  /// snapshot rendering doesn't preserve live blur effects.
  ///
  /// The FLIP technique (Paul Lewis, 2015) sidesteps the
  /// snapshot machinery entirely by animating only `transform`
  /// on the elements that move:
  ///
  ///   1. **First**:  capture each button's `DOMRect` BEFORE
  ///      the state change.
  ///   2. **Last**:   apply state change → Solid re-renders
  ///      synchronously → measure new rects.
  ///   3. **Invert**: compute delta and apply
  ///      `transform: translate(dx, dy)` so each element is
  ///      visually back at its old position.
  ///   4. **Play**:   animate the transform to identity via
  ///      Web Animations API. The element slides smoothly
  ///      from old to new layout position.
  ///
  /// `transform` is GPU-composited and doesn't trigger the
  /// page-snapshot path, so sibling elements (the scrim, the
  /// Continue button) keep rendering live. Backdrop-filter
  /// stays intact throughout.
  const buttonRefs = new Map<string, HTMLButtonElement>();
  const inFlight = new Map<string, Animation>();
  /// Ref to the horizontal scroll container so
  /// `handleSelectContact` can rewind it to the leading
  /// edge after a contact is promoted to active.
  let scrollEl: HTMLDivElement | undefined;

  const flipReorder = (mutate: () => void) => {
    // FIRST: capture old positions. Cancel any in-flight
    // animations first so the rect we read is the settled
    // post-animation position, not a transformed mid-anim
    // frame.
    const firstRects = new Map<string, DOMRect>();
    buttonRefs.forEach((el, key) => {
      const ongoing = inFlight.get(key);
      if (ongoing) {
        ongoing.cancel();
        inFlight.delete(key);
      }
      firstRects.set(key, el.getBoundingClientRect());
    });

    // STATE CHANGE: Solid's signal updates flush DOM
    // bindings synchronously, so by the time `mutate`
    // returns, the new layout is already committed. Reading
    // rects on the next line forces a synchronous reflow but
    // gives us accurate post-state geometry.
    mutate();

    // LAST + INVERT + PLAY: in one synchronous pass per
    // element so the user never sees an unwanted flash of
    // the post-state layout.
    buttonRefs.forEach((el, key) => {
      const first = firstRects.get(key);
      if (!first) return;
      const last = el.getBoundingClientRect();
      const dx = first.left - last.left;
      const dy = first.top - last.top;
      // Skip elements that didn't actually move — sub-pixel
      // jitter shouldn't trigger a 450ms animation.
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;

      const anim = el.animate(
        [
          { transform: `translate(${dx}px, ${dy}px)` },
          { transform: "translate(0, 0)" },
        ],
        {
          duration: 450,
          easing: "cubic-bezier(0.32, 0.72, 0, 1)",
          // `fill: "none"` so after the animation the element
          // returns to its natural CSS state (no leftover
          // transform on the inline style). Web Animations
          // handles cleanup automatically.
          fill: "none",
        },
      );
      inFlight.set(key, anim);
      anim.onfinish = () => inFlight.delete(key);
      anim.oncancel = () => inFlight.delete(key);
    });
  };

  const handleSelectContact = (id: string) => {
    if (props.activeContactId === id) {
      // Tapping the already-active contact is a no-op for
      // selection. We still bubble it up to the parent so
      // the gate logic (e.g., liveStatus check) gets a
      // chance to run, but skip the FLIP machinery since
      // nothing is reordering.
      props.onSelectContact(id);
      return;
    }
    flipReorder(() => props.onSelectContact(id));
    // Scroll the row back to the beginning so the now-active
    // contact (which moves to index 0 by the reorder) is in
    // view. If the user had scrolled right to tap a contact
    // deep in the list, that contact's avatar would otherwise
    // grow at the leading edge offscreen and the user would
    // see... nothing meaningful. The smooth scroll runs in
    // parallel with the 450ms FLIP transform, so the swap
    // and the rewind read as one motion.
    scrollEl?.scrollTo({ left: 0, behavior: "smooth" });
  };

  return (
    <div
      ref={(el) => (scrollEl = el)}
      // No top padding — the parent ItemsView's bottom-bar
      // wrapper already reserves a 40px gradient fade zone
      // above this row (`pt-[40px]` on the bar's outer div),
      // so the avatars sit naturally just below the fade.
      // Bottom padding stays at `pb-3` (12pt) — the Continue
      // button below provides its own spacing.
      class="safe-px pb-3 flex items-center gap-3 overflow-x-auto"
      style={{
        // Hide the scrollbar — iOS doesn't show one on
        // horizontal contact rows. The pseudo-element rule
        // covers WebKit (Safari/Chrome); the standard
        // `scrollbar-width` covers Firefox.
        "scrollbar-width": "none",
        // Stop horizontal swipes here from triggering the
        // browser's "back" gesture on iOS Safari / Chrome
        // Android. Without this, dragging a contact pill
        // sideways could navigate away from the SPA.
        "overscroll-behavior-x": "contain",
      }}
    >
      {/* Everyone pill at index 0 when active. */}
      <Show when={isEveryoneActive()}>
        <EveryonePill
          active
          onClick={() => handleSelectContact(EVERYONE_ID)}
          ref={(el) => buttonRefs.set(EVERYONE_ID, el)}
        />
      </Show>

      <For each={orderedContacts()}>
        {(contact) => {
          const isActive = () => props.activeContactId === contact.id;
          const size = () =>
            isActive() ? ACTIVE_AVATAR : INACTIVE_AVATAR;
          const total = () => props.totalsByContact.get(contact.id) ?? 0;
          return (
            <button
              type="button"
              class="shrink-0 flex items-center gap-2 active:opacity-70 transition-opacity"
              onClick={() => handleSelectContact(contact.id)}
              aria-label={`Select ${labelFor(contact)}`}
              // `ref` registers this button in `buttonRefs`
              // so the FLIP routine can measure its position
              // before/after the state change. Solid's <For>
              // is keyed by reference, so each contact's
              // button DOM node is stable across reorders —
              // we register once per contact and the same
              // element animates each subsequent reorder.
              ref={(el) => buttonRefs.set(contact.id, el)}
            >
              {/* Payer indicator only appears INLINE next to
                  the active contact's name (rendered below).
                  Inactive avatars never carry the credit-card
                  glyph — the previous corner-badge treatment
                  bled the indicator across the whole row when
                  the payer wasn't selected, which was visually
                  noisy. iOS's `contactChip` shows the credit-
                  card image only inside the active contact's
                  expanded label too. */}
              <span
                class="relative inline-block"
                style={{
                  width: `${size()}px`,
                  height: `${size()}px`,
                  // Match the Avatar's internal width/height
                  // transition so the wrapper resizes in
                  // lockstep — otherwise the wrapper would
                  // snap while the inner avatar smoothly
                  // animated, looking janky.
                  transition:
                    "width 450ms cubic-bezier(0.32, 0.72, 0, 1), height 450ms cubic-bezier(0.32, 0.72, 0, 1)",
                }}
              >
                <Avatar
                  size={size()}
                  fullName={contact.fullName}
                  imageURL={contact.avatarUrl}
                  // Pre-composited gray-fill: Avatar's default
                  // bg is `rgba(142,142,147,0.5)` (the iOS gray-
                  // fill token, semi-transparent so it picks up
                  // whatever's behind). In ContactsRow the bar's
                  // mask gradient renders the area behind the
                  // avatar partly transparent, which would let
                  // the items list bleed into the avatar's
                  // backing too. Override with the same color
                  // pre-composited over black: 0.5×(142,142,147)
                  // + 0.5×(0,0,0) = rgb(71,71,74) — visually
                  // identical to the original-on-black, but
                  // FULLY OPAQUE so it stays solid regardless
                  // of what the bar mask does.
                  style={{ "background-color": "rgb(71, 71, 74)" }}
                />
              </span>
              <Show when={isActive()}>
                <div class="flex flex-col leading-tight items-start">
                  <span class="text-ios-footnote text-ios-label-secondary flex items-center gap-1">
                    {labelFor(contact)}
                    <Show when={isPayer(contact)}>
                      <CreditCardGlyph size={12} />
                    </Show>
                  </span>
                  <span class="text-ios-headline text-ios-label">
                    {formatCurrency(total(), props.currencyCode)}
                  </span>
                </div>
              </Show>
            </button>
          );
        }}
      </For>

      {/* Inactive Everyone pill at the trailing edge. */}
      <Show when={!isEveryoneActive()}>
        <EveryonePill
          active={false}
          onClick={() => handleSelectContact(EVERYONE_ID)}
          ref={(el) => buttonRefs.set(EVERYONE_ID, el)}
        />
      </Show>
    </div>
  );
}

interface EveryonePillProps {
  active: boolean;
  onClick: () => void;
  /// Ref callback so the parent FLIP routine can measure
  /// this button's position before / after a state change.
  /// Same shape as Solid's built-in `ref` callback prop on
  /// native elements.
  ref?: (el: HTMLButtonElement) => void;
}

function EveryonePill(props: EveryonePillProps) {
  const size = () => (props.active ? ACTIVE_AVATAR : INACTIVE_AVATAR);
  return (
    <button
      type="button"
      class="shrink-0 flex items-center gap-2 active:opacity-70 transition-opacity"
      onClick={() => props.onClick()}
      aria-label="Select Everyone"
      ref={(el) => props.ref?.(el)}
    >
      <span
        class="inline-block"
        style={{
          width: `${size()}px`,
          height: `${size()}px`,
          transition:
            "width 450ms cubic-bezier(0.32, 0.72, 0, 1), height 450ms cubic-bezier(0.32, 0.72, 0, 1)",
        }}
      >
        <Avatar
          size={size()}
          variant="everyone"
          // Same pre-composited opaque gray-fill as the per-
          // contact avatars above — keeps the "Everyone" pill
          // visually flush with them on the masked bar.
          style={{ "background-color": "rgb(71, 71, 74)" }}
        />
      </span>
      <Show when={props.active}>
        <div class="flex flex-col leading-tight items-start">
          <span class="text-ios-footnote text-ios-label-secondary">
            Everyone
          </span>
        </div>
      </Show>
    </button>
  );
}

/// SF Symbol `creditcard.fill` exported from Apple's CoreSVG.
/// Path data verbatim from the SF Symbols app — natural viewBox
/// is 12.041 × 8.34473 (landscape rectangle, not square), so we
/// honor that aspect ratio: `size` becomes the rendered height
/// and width follows the ratio. `currentColor` lets the parent
/// `text-ios-blue` class tint it.
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
