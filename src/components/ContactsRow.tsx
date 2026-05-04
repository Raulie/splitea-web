import { For, Show } from "solid-js";
import type { ContactPayload } from "../types/snapshot";
import { Avatar } from "./Avatar";
import { formatCurrency } from "../lib/format";

/// Sticky bottom bar — payer avatar (with credit-card glyph
/// + total label), other contacts as pill avatars, "Everyone"
/// circle, and an "Add contact" affordance. Mirrors the iOS
/// `bottomBar` block in `ItemsView.swift`.
///
/// All read-only on Day 2. Taps don't switch active contact /
/// add new ones yet — that's Day 3 + Day 4 wiring.
export interface ContactsRowProps {
  contacts: ContactPayload[];
  /// Local viewer's userId (resolved via web SIWA on Day 4;
  /// for now `null` until we know who's looking).
  meContactId: string | null;
  /// Pre-computed total per contact. Parent owns the math.
  totalsByContact: Map<string, number>;
  currencyCode: string;
  /// PayerPhoneNumber from the snapshot — use to highlight the
  /// payer with the credit-card icon.
  payerPhoneNumber: string | null;
}

export function ContactsRow(props: ContactsRowProps) {
  /// The "Me" entry comes first when present; everyone else
  /// follows in the order they were added (snapshot order).
  const meContact = () =>
    props.meContactId
      ? props.contacts.find((c) => c.id === props.meContactId) ?? null
      : null;
  const others = () =>
    props.contacts.filter((c) => c.id !== meContact()?.id);

  /// Match payer by phone-number suffix — same heuristic the
  /// iOS app uses (handles country-code / formatting drift).
  const isPayer = (contact: ContactPayload) => {
    if (!props.payerPhoneNumber) return false;
    const a = contact.phoneNumber.replace(/\D/g, "");
    const b = props.payerPhoneNumber.replace(/\D/g, "");
    if (!a || !b) return false;
    return a.endsWith(b) || b.endsWith(a);
  };

  return (
    <div class="px-4 py-3 flex items-center gap-3 overflow-x-auto">
      <Show when={meContact()}>
        {(me) => {
          const total = () => props.totalsByContact.get(me().id) ?? 0;
          return (
            <div class="shrink-0 flex items-center gap-2">
              <div class="relative">
                <Avatar size={48} fullName={me().fullName} class="ring-2 ring-ios-blue" />
              </div>
              <div class="flex flex-col leading-tight">
                <span class="text-ios-footnote text-ios-label-secondary flex items-center gap-1">
                  Me
                  <Show when={isPayer(me())}>
                    <CreditCardGlyph size={12} />
                  </Show>
                </span>
                <span class="text-ios-headline text-ios-label">
                  {formatCurrency(total(), props.currencyCode)}
                </span>
              </div>
            </div>
          );
        }}
      </Show>
      <For each={others()}>
        {(contact) => (
          <div class="shrink-0 relative">
            <Avatar size={44} fullName={contact.fullName} />
            <Show when={isPayer(contact)}>
              <span class="absolute -bottom-0.5 -right-0.5 bg-ios-bg p-0.5 rounded-full">
                <CreditCardGlyph size={14} />
              </span>
            </Show>
          </div>
        )}
      </For>
      <Avatar size={44} variant="everyone" />
      <button
        type="button"
        class="shrink-0 w-11 h-11 rounded-full bg-ios-card-hi flex items-center justify-center text-ios-label-secondary"
        aria-label="Add Contact"
      >
        <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
          <path d="M12 12.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm-7.5 8c0-3.04 3.36-5.5 7.5-5.5s7.5 2.46 7.5 5.5V22h-15v-1.5Z" />
          <circle cx="19" cy="19" r="3" fill="#0a84ff" stroke="#000" stroke-width="1" />
          <path d="M19 17.5v3M17.5 19h3" stroke="#fff" stroke-width="1" stroke-linecap="round" />
        </svg>
      </button>
    </div>
  );
}

function CreditCardGlyph(props: { size: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={props.size}
      height={props.size}
      fill="currentColor"
      class="text-ios-blue"
      aria-hidden="true"
    >
      <path d="M3 6.5A2.5 2.5 0 0 1 5.5 4h13A2.5 2.5 0 0 1 21 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5v-11Zm0 3v8c0 .83.67 1.5 1.5 1.5h15A.5.5 0 0 0 20 18.5v-9H3Z" />
    </svg>
  );
}
