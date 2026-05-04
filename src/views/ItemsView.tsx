import { useParams } from "@solidjs/router";
import { createMemo, createResource, Match, Switch } from "solid-js";
import type { ContactPayload, ReceiptSnapshot } from "../types/snapshot";
import { fetchSnapshot, ShareFetchError } from "../lib/api";
import { ReceiptInfoCard } from "../components/ReceiptInfoCard";
import { ItemsList } from "../components/ItemsList";
import { ContactsRow } from "../components/ContactsRow";

/// Day-2 read-only render of the receipt. Mirrors the iOS
/// `ItemsView` layout from the App Store preview screenshot:
/// header chrome (back / edit / title / subtitle), receipt-
/// info card, items list, sticky bottom contacts row, and the
/// Continue CTA. WebSocket-driven mutations and Sign-in-with-
/// Apple come in Day 3 / Day 4.
export function ItemsView() {
  const params = useParams<{ shareID: string }>();
  const [snapshot] = createResource(
    () => params.shareID,
    (id) => fetchSnapshot(id),
  );

  return (
    <div class="min-h-dvh flex flex-col bg-ios-bg text-ios-label">
      <Switch>
        <Match when={snapshot.loading}>
          <LoadingState />
        </Match>
        <Match when={snapshot.error instanceof ShareFetchError && (snapshot.error as ShareFetchError).kind === "expired"}>
          <ExpiredState />
        </Match>
        <Match when={snapshot.error}>
          <ErrorState />
        </Match>
        <Match when={snapshot()}>
          {(snap) => <Loaded snapshot={snap()} />}
        </Match>
      </Switch>
    </div>
  );
}

function Loaded(props: { snapshot: ReceiptSnapshot }) {
  /// Index assignments by item id once for fast per-row lookup.
  const assignmentsByItem = createMemo(() => {
    const contactsById = new Map(props.snapshot.contacts.map((c) => [c.id, c]));
    const map = new Map<string, ContactPayload[]>();
    for (const a of props.snapshot.assignments) {
      const contact = contactsById.get(a.contactId);
      if (!contact) continue;
      const list = map.get(a.itemId) ?? [];
      list.push(contact);
      map.set(a.itemId, list);
    }
    return map;
  });

  /// Per-contact totals — subtotal + share of taxes + share of
  /// tip. iOS does the same math in `BillCalculationService`;
  /// we replicate the formula client-side until the WebSocket-
  /// driven viewmodel arrives in Day 3.
  const totalsByContact = createMemo(() => {
    const totals = new Map<string, number>();
    const items = props.snapshot.items;
    const subtotal = items.reduce((sum, item) => sum + item.price, 0);
    const tipValue = props.snapshot.receipt.tipValue;
    const tipType = props.snapshot.receipt.tipType;
    const tipAmount =
      tipType === "percentage" ? (subtotal * tipValue) / 100 : tipValue;
    for (const item of items) {
      const assignees = assignmentsByItem().get(item.id) ?? [];
      if (assignees.length === 0) continue;
      const itemSubtotal = item.price / assignees.length;
      const itemTax =
        item.tax !== null && item.tax !== undefined && item.tax > 0
          ? (item.price * item.tax) / 100 / assignees.length
          : 0;
      for (const a of assignees) {
        totals.set(a.id, (totals.get(a.id) ?? 0) + itemSubtotal + itemTax);
      }
    }
    /// Distribute tip proportionally to each contact's pre-tip
    /// share. Matches iOS `calculateContactBreakdowns` logic.
    if (tipAmount > 0 && subtotal > 0) {
      for (const [contactId, raw] of totals) {
        // Pre-tip share = raw subtotal+tax for this contact;
        // tip portion = tip × (contact subtotal / total subtotal).
        // The iOS math weights tip on subtotal only, not subtotal+tax,
        // so do the same here.
        const itemSubtotalForContact = items.reduce((sum, item) => {
          const assignees = assignmentsByItem().get(item.id) ?? [];
          if (!assignees.find((a) => a.id === contactId)) return sum;
          return sum + item.price / assignees.length;
        }, 0);
        const tipShare = (tipAmount * itemSubtotalForContact) / subtotal;
        totals.set(contactId, raw + tipShare);
      }
    }
    return totals;
  });

  /// Best-effort "Me" detection until we wire web SIWA. Picks
  /// the first contact with `isUserContact: true`. iOS always
  /// flags exactly one such contact at create time.
  const meContactId = createMemo(() => {
    return (
      props.snapshot.contacts.find((c) => c.isUserContact)?.id ?? null
    );
  });

  return (
    <>
      {/* Top chrome — back + edit buttons floating in the safe
          area, then the heading. Matches the iOS preview's
          chevron-back / pencil-edit pattern. Edit is visually
          present but disabled in Day 2; activates in Day 3. */}
      <div class="px-4 pt-[env(safe-area-inset-top)] pt-4">
        <div class="flex items-center justify-between mb-4">
          <button
            type="button"
            class="w-9 h-9 rounded-full bg-ios-card flex items-center justify-center text-ios-label active:opacity-60 transition-opacity"
            aria-label="Back"
            onClick={() => history.back()}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
              <path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12l4.58-4.59Z" />
            </svg>
          </button>
          <button
            type="button"
            class="w-9 h-9 rounded-full bg-ios-card flex items-center justify-center text-ios-label opacity-60 cursor-not-allowed"
            aria-label="Edit"
            disabled
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
              <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25Zm17.71-10.04a1 1 0 0 0 0-1.41l-2.51-2.51a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83Z" />
            </svg>
          </button>
        </div>
        <h1 class="text-ios-large-title text-ios-label">Assign Items</h1>
        <p class="text-ios-body text-ios-label-secondary mt-1">
          Tap a contact, then tap their items to assign them.
        </p>
      </div>

      {/* Body — receipt info + items list. Bottom padding
          accounts for the sticky contacts row + Continue
          button below. */}
      <main class="flex-1 px-4 mt-6 pb-[230px] space-y-6">
        <ReceiptInfoCard
          merchantName={props.snapshot.receipt.merchantName}
          receiptDate={props.snapshot.receipt.receiptDate}
        />
        <ItemsList
          items={props.snapshot.items}
          assignmentsByItem={assignmentsByItem()}
          totalContactCount={props.snapshot.contacts.length}
          currencyCode={props.snapshot.receipt.currencyCode}
        />
      </main>

      {/* Sticky bottom: contacts row + Continue. Backdrop blur
          replicates iOS's translucent toolbar. */}
      <div class="fixed bottom-0 left-0 right-0 bg-ios-bg/85 backdrop-blur-md border-t border-ios-separator pb-[env(safe-area-inset-bottom)]">
        <ContactsRow
          contacts={props.snapshot.contacts}
          meContactId={meContactId()}
          totalsByContact={totalsByContact()}
          currencyCode={props.snapshot.receipt.currencyCode}
          payerPhoneNumber={props.snapshot.receipt.payerPhoneNumber}
        />
        <div class="px-4 pb-3 pt-1">
          <button
            type="button"
            class="w-full h-12 rounded-full bg-ios-blue text-white text-ios-headline font-semibold active:opacity-80 transition-opacity"
          >
            Continue
          </button>
        </div>
      </div>
    </>
  );
}

function LoadingState() {
  return (
    <div class="flex-1 flex items-center justify-center">
      <div class="text-ios-label-secondary text-ios-body">Loading…</div>
    </div>
  );
}

function ExpiredState() {
  return (
    <div class="flex-1 flex flex-col items-center justify-center px-6 text-center gap-4">
      <h1 class="text-ios-title-2">This link has expired</h1>
      <p class="text-ios-body text-ios-label-secondary max-w-xs">
        Splitea share links expire after 7 days. Ask your friend to send a new one.
      </p>
    </div>
  );
}

function ErrorState() {
  return (
    <div class="flex-1 flex flex-col items-center justify-center px-6 text-center gap-4">
      <h1 class="text-ios-title-2">Couldn't load this receipt</h1>
      <p class="text-ios-body text-ios-label-secondary max-w-xs">
        Try again in a moment. If the problem persists, ask your friend to
        send a new share link.
      </p>
    </div>
  );
}
