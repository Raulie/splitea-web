import { createMemo, createSignal, For, onMount, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { ChevronGlyph } from "./ChevronGlyph";
import { Avatar } from "./Avatar";
import {
  configuredPayProviders,
  spliteaShareURL,
  type PayProvider,
} from "../lib/payProviders";
import { formatCurrency } from "../lib/format";

/// "Pay <Sender>" provider-picker sheet shown when the
/// recipient taps the Pay button on `SavedReceiptView`.
///
/// Two stages:
///
///   1. **Identity picker.** Shown the first time the
///      recipient opens this share's modal. Lists every
///      non-payer contact ("which one of these is you?")
///      so we can match them to a specific breakdown
///      amount. Selection is persisted to localStorage,
///      keyed by receiptID — subsequent opens of the same
///      share skip straight to stage 2.
///
///   2. **Provider picker.** Same list of providers as
///      before, but now with the recipient's identity
///      known the destination URL gets built via
///      `paymentURL(amount, currency, note)` instead of
///      `profileURL(username)` — so PayPal, Revolut, Cash
///      App, etc. open with the right amount prefilled.
///
/// A small "Not <name>?" affordance in stage 2's header
/// flips back to stage 1 and clears the cached identity.
///
/// Visual: bottom-anchored sheet, frosted-glass backdrop,
/// iOS-26 spring slide-up animation, hairline-separated
/// rows. The two stages share the same sheet container —
/// no inter-stage transition for now (just swap content);
/// the slide-up is the only motion the user sees.
export interface PayMenuSheetProps {
  /// Display name of the share's payer (sender). Shown in
  /// the sheet header.
  payerDisplayName: string;
  /// Sender's payment-username dict from
  /// `ContactPayload.paymentUsernames` — keyed by
  /// `PaymentProvider.rawValue`.
  paymentUsernames: Record<string, string> | null | undefined;
  /// Receipt UUID. Used as the localStorage key suffix
  /// for the cached identity choice — different receipts
  /// stay independent.
  receiptID: string;
  /// Non-payer candidates. Each entry is one contact who
  /// could be the visitor, with their share total
  /// pre-computed by the parent's breakdown calculator.
  candidates: PayCandidate[];
  /// ISO 4217 currency for amount formatting in the UI
  /// AND for the destination URL builders that take a
  /// currency code.
  currencyCode: string;
  /// Receipt's merchant name — feeds the "Your share at
  /// <merchant>…" payment-note string.
  merchantName: string | null;
  /// When set, treated as the visitor's identity with priority
  /// over both the localStorage cache and the
  /// single-candidate fallback. Used by the "Request payment"
  /// flow — the sender's URL carries `?for=<contactId>`, so
  /// the recipient lands straight on the providers stage
  /// without seeing the "which one are you?" picker. Stale
  /// values (contact missing from `candidates`) silently fall
  /// through to the regular initial-identity logic.
  forcedContactId?: string | null;
  /// Called once the slide-down exit animation completes.
  onClose: () => void;
}

export interface PayCandidate {
  contactId: string;
  /// Pre-formatted display name. Falls back to "Someone"
  /// if the snapshot has no full name for this contact.
  displayName: string;
  /// Total this contact owes (subtotal + tax + tip),
  /// in major units of `currencyCode`.
  amount: number;
  /// Public splitea-id avatar URL (with `?v=` cache-buster).
  /// Optional — null when this candidate's snapshot row has
  /// no directory match. Avatar component falls back to
  /// initials when omitted.
  avatarUrl?: string | null;
}

/// Keep in sync with `.pay-sheet` transition duration in
/// `index.css`.
const PAY_SHEET_ANIMATION_MS = 380;

/// Returns the localStorage key used to persist the
/// identity choice for a given receipt. One choice per
/// receipt ID — switching browsers / clearing storage
/// resets the picker, which is fine.
function identityCacheKey(receiptID: string): string {
  return `splitea:pay-identity:${receiptID}`;
}

export function PayMenuSheet(props: PayMenuSheetProps) {
  const providerEntries = () =>
    configuredPayProviders(props.paymentUsernames);

  /// Initial identity. Four sources, in priority order:
  ///
  ///   1. `forcedContactId` from the parent (Request-link
  ///      flow). Validated against the candidate list so a
  ///      stale URL drops to the next source. Bypasses the
  ///      cache entirely — the sender's intent is
  ///      authoritative when explicit.
  ///   2. localStorage cache from a prior visit. Validated
  ///      against the current candidate list so a stale ID
  ///      (contact removed from the snapshot since the
  ///      cache was written) drops us back to the picker.
  ///   3. Single-candidate auto-select. When there's exactly
  ///      one non-payer contact, there's no ambiguity — skip
  ///      the picker and go straight to providers.
  ///   4. `null`, which surfaces the picker.
  const initialIdentity = (): string | null => {
    const forced = props.forcedContactId;
    if (forced && props.candidates.some((c) => c.contactId === forced)) {
      return forced;
    }
    try {
      const raw = localStorage.getItem(identityCacheKey(props.receiptID));
      if (raw && props.candidates.some((c) => c.contactId === raw)) {
        return raw;
      }
    } catch {
      // Storage disabled (Safari private mode pre-iOS 16,
      // sandboxed iframes). Fall through to the
      // single-candidate / picker paths.
    }
    if (props.candidates.length === 1) {
      return props.candidates[0]!.contactId;
    }
    return null;
  };

  const [selectedContactId, setSelectedContactId] = createSignal<string | null>(
    initialIdentity(),
  );

  const selectedCandidate = createMemo(() => {
    const id = selectedContactId();
    if (!id) return null;
    return props.candidates.find((c) => c.contactId === id) ?? null;
  });

  /// Stage is derived: identity picker until a candidate
  /// is selected, providers thereafter.
  const stage = (): "identity" | "providers" =>
    selectedCandidate() === null ? "identity" : "providers";

  /// Mount-time animation flags — same two-frame pattern as
  /// `ReceiptViewer` so the browser actually transitions
  /// from off-screen to presented instead of jumping.
  const [presented, setPresented] = createSignal(false);
  const [dismissing, setDismissing] = createSignal(false);

  onMount(() => {
    requestAnimationFrame(() => setPresented(true));
  });

  function handleDismiss() {
    if (dismissing()) return;
    setDismissing(true);
    setPresented(false);
    setTimeout(() => props.onClose(), PAY_SHEET_ANIMATION_MS);
  }

  function chooseIdentity(contactId: string) {
    setSelectedContactId(contactId);
    try {
      localStorage.setItem(identityCacheKey(props.receiptID), contactId);
    } catch {
      // Ignore storage failures — the in-memory selection
      // still works for the rest of this modal session.
    }
  }

  function clearIdentity() {
    setSelectedContactId(null);
    try {
      localStorage.removeItem(identityCacheKey(props.receiptID));
    } catch {
      /* noop */
    }
  }

  function urlForProvider(provider: PayProvider, username: string): string {
    const candidate = selectedCandidate();

    // ATH Móvil's universal link doesn't accept amount —
    // we previously re-encrypted the stored token with an
    // injected `amount=` field hoping ATHM's newer client
    // would read it, but the parser silently drops the
    // injected field AND in some configurations rejects
    // the modified ciphertext as malformed. So we fall
    // through to `provider.paymentURL` which is the
    // no-amount form for athMovil — recipient pays the
    // handle, types the amount manually. The amount stays
    // in the iMessage caption / Splitea share preview, so
    // it's still communicated, just not prefilled.

    // We route the click through `splitea.app/p/<slug>/<b64u>?go=1`
    // rather than linking directly to the destination URL.
    // Reasons:
    //
    //   1. Server-side iOS / Android URL rewrites stay in
    //      one place. The Venmo iOS app's Universal Link
    //      handler renders `%20` and `+` both as literal `+`
    //      in the note field — the worker swaps the HTTPS
    //      URL to `venmo://paycharge?...` for iOS, where the
    //      custom-scheme handler decodes spaces correctly.
    //      ATH Móvil on Android needs an `intent://` URI
    //      with the consumer-app package id. Centralising
    //      these in splitea-shares avoids duplicating the
    //      logic in every client (iOS, web).
    //   2. The `?go=1` query param tells the worker to
    //      return a 302 redirect instead of the OG-tagged
    //      hand-off HTML — no visible intermediate page,
    //      visitor lands straight in the provider app.
    //   3. The HTTPS round-trip + redirect dispatch gives
    //      Venmo's iOS launch sequence enough grace on
    //      cold-start that the deep link routes through the
    //      payment handler rather than the QR/code parser
    //      (which fails with "we don't recognize that code"
    //      when iOS hands `venmo://...` to a fresh-launched
    //      Venmo without that small breathing room).
    //
    // Default (`/p/...` without `?go=1`) still serves the
    // OG-tagged HTML page — that's the path the iOS app
    // generates for iMessage rich-preview cards when it
    // shares a payment-request link.
    if (candidate) {
      const dest = provider.paymentURL({
        username,
        amount: candidate.amount,
        currencyCode: props.currencyCode,
        merchantName: props.merchantName,
      });
      return spliteaShareURL(provider.slug, dest) + "?go=1";
    }
    // Defensive: if we somehow got here without a
    // candidate (shouldn't happen — the providers stage
    // is gated on selectedCandidate being non-null), fall
    // back to the no-amount profile URL so the user still
    // gets SOMEWHERE.
    const dest = provider.profileURL(username);
    return spliteaShareURL(provider.slug, dest) + "?go=1";
  }

  // No JS-driven navigation; provider rows are real `<a>`
  // anchors so the browser handles the tap as a user-
  // initiated link click. That's required for iOS to route
  // the splitea.app/p/... URL via Universal Link into the
  // installed provider app (Revolut, Cash App, Monzo) with
  // the prefilled amount intact — programmatic navigations
  // (`window.location.assign` / `window.open`) get gated to
  // in-Safari behaviour, and several providers silently drop
  // the amount in that path.
  //
  // Navigation happens IN THE SAME TAB (no `target="_blank"`)
  // so the typical flow on iOS — tap row → Universal Link
  // hands off to provider app → user pays → swipes back to
  // Safari — lands back on the Splitea receipt rather than
  // an empty intermediate `/p/...` tab. Desktop users return
  // via the back button.

  return (
    <Show when={providerEntries().length > 0}>
      <Portal>
      <div
        class="fixed inset-0 z-40 bg-black/40 pay-backdrop"
        classList={{ "pay-backdrop-presented": presented() }}
        onClick={handleDismiss}
        aria-hidden="true"
      />
      <div class="fixed inset-x-0 bottom-0 z-50 flex justify-center pointer-events-none">
      <div
        class="pointer-events-auto w-full sm:max-w-md bg-ios-card text-ios-label rounded-t-ios-sheet pb-[env(safe-area-inset-bottom)] shadow-2xl pay-sheet"
        classList={{ "pay-sheet-presented": presented() }}
        role="dialog"
        aria-modal="true"
        aria-label={`Pay ${props.payerDisplayName}`}
      >
        {/* Drag-affordance bar — decorative; matches the
            iOS sheet idiom. */}
        <div class="flex justify-center pt-3 pb-1">
          <div class="h-1 w-9 rounded-full bg-ios-label-tertiary" />
        </div>

        <Show when={stage() === "identity"}>
          <IdentityStage
            payerDisplayName={props.payerDisplayName}
            candidates={props.candidates}
            currencyCode={props.currencyCode}
            onPick={chooseIdentity}
          />
        </Show>

        <Show when={stage() === "providers"}>
          <ProvidersStage
            candidate={selectedCandidate()!}
            currencyCode={props.currencyCode}
            entries={providerEntries()}
            buildURL={urlForProvider}
            // Only offer the "Not me, switch identity" link
            // when there's actually somebody else to switch
            // to. With a single candidate we landed here by
            // auto-select, and re-picking would just re-
            // select the same contact.
            onChangeIdentity={
              props.candidates.length > 1 ? clearIdentity : undefined
            }
          />
        </Show>
      </div>
      </div>
      </Portal>
    </Show>
  );
}

interface IdentityStageProps {
  payerDisplayName: string;
  candidates: PayCandidate[];
  currencyCode: string;
  onPick: (contactId: string) => void;
}

/// Stage 1: "Which contact are you?" with the candidate
/// list. Each row shows an Avatar, display name, and
/// the amount that contact owes — so the visitor has a
/// double cue (their name + their expected total) for
/// picking the right row without second-guessing.
function IdentityStage(props: IdentityStageProps) {
  return (
    <>
      <div class="px-5 pt-2 pb-1 text-center">
        <h3 class="text-ios-headline text-ios-label">Who are you?</h3>
        <p class="text-ios-footnote text-ios-label-secondary mt-1">
          Pick yourself so we can prefill the amount you owe{" "}
          {props.payerDisplayName}.
        </p>
      </div>
      <ul class="px-2 pt-2 pb-3">
        <For each={props.candidates}>
          {(c, i) => (
            <li>
              <button
                type="button"
                class="w-full flex items-center gap-3 px-3 py-3 rounded-ios-card-inner active:bg-ios-card-hi transition-colors"
                onClick={() => props.onPick(c.contactId)}
              >
                <Avatar
                  fullName={c.displayName}
                  imageURL={c.avatarUrl}
                  size={36}
                />
                {/*
                  Typography matches `ContactBreakdownRow`'s
                  disclosure summary: `.subheadline.semibold`
                  on both name AND amount, primary label color
                  on both. Was `.body` regular + secondary on
                  the amount, which read as a different visual
                  weight than the matching breakdown rows on
                  the underlying SavedReceiptView and made the
                  identity-picker feel like a different
                  surface. Tabular nums kept on the amount so
                  multi-row dollar figures align right-edge.
                */}
                <span class="flex-1 text-left text-ios-subheadline font-semibold text-ios-label truncate">
                  {c.displayName}
                </span>
                <span class="text-ios-subheadline font-semibold text-ios-label tabular-nums">
                  {formatCurrency(c.amount, props.currencyCode)}
                </span>
                <ChevronGlyph
                  size={13}
                  rotation={180}
                  class="text-ios-label-tertiary shrink-0"
                />
              </button>
              <Show when={i() < props.candidates.length - 1}>
                <div class="ios-hairline mx-3" />
              </Show>
            </li>
          )}
        </For>
      </ul>
    </>
  );
}

interface ProvidersStageProps {
  candidate: PayCandidate;
  currencyCode: string;
  entries: { provider: PayProvider; username: string }[];
  /// Builds the splitea.app/p/<slug>/<b64u> URL for the
  /// given provider + username — closure over the
  /// currently-selected candidate's amount so each row's
  /// `<a href>` resolves to the right amount-prefilled
  /// destination.
  buildURL: (provider: PayProvider, username: string) => string;
  /// Optional. When undefined, the "Not <name>?" link is
  /// hidden — used in the single-candidate case where
  /// switching identity is meaningless.
  onChangeIdentity?: () => void;
}

/// Stage 2: provider list with the recipient's amount in
/// the header. The "Not <name>?" link in the sub-row flips
/// back to stage 1 in case they tapped the wrong identity
/// (or they're sharing the device with another household
/// member splitting the same bill).
function ProvidersStage(props: ProvidersStageProps) {
  return (
    <>
      <div class="px-5 pt-2 pb-1 text-center">
        <h3 class="text-ios-headline text-ios-label">
          Pay {formatCurrency(props.candidate.amount, props.currencyCode)}
        </h3>
        <Show when={props.onChangeIdentity}>
          <button
            type="button"
            class="text-ios-footnote text-ios-blue mt-1 active:opacity-60 transition-opacity"
            onClick={() => props.onChangeIdentity?.()}
          >
            Not {props.candidate.displayName}?
          </button>
        </Show>
      </div>
      <ul class="px-2 pt-2 pb-3">
        <For each={props.entries}>
          {(entry, i) => (
            <li>
              {/* Provider rows are real anchors so the click
                  registers as user-initiated — required for
                  iOS Universal Links to route the
                  splitea.app/p/... URL through the worker's
                  auto-redirect into the destination provider's
                  app with the amount prefilled. Same-tab
                  navigation (no `target="_blank"`) keeps the
                  user on a single Safari tab end-to-end:
                  tap → Universal Link → pay in provider app →
                  swipe back to Safari, landing on the
                  receipt rather than an empty `/p/...` tab.
                  `rel="external"` is the @solidjs/router
                  opt-out — without it the Router intercepts
                  the same-origin click and tries to match
                  `/p/<slug>/<b64u>` against the SPA route
                  table, falling through to NotFound. We want
                  a real browser navigation so Cloudflare hands
                  the request to the splitea-shares worker
                  that owns `/p/*`. */}
              <a
                href={props.buildURL(entry.provider, entry.username)}
                rel="external"
                class="w-full flex items-center gap-3 px-3 py-3 rounded-ios-card-inner active:bg-ios-card-hi transition-colors"
              >
                <img
                  src={`/p/${entry.provider.slug}/icon.png`}
                  alt=""
                  width={36}
                  height={36}
                  class="rounded-[8px] shrink-0"
                />
                <span class="flex-1 text-left text-ios-body text-ios-label">
                  {entry.provider.displayName}
                </span>
                <ChevronGlyph
                  size={13}
                  rotation={180}
                  class="text-ios-label-tertiary shrink-0"
                />
              </a>
              <Show when={i() < props.entries.length - 1}>
                <div class="ios-hairline mx-3" />
              </Show>
            </li>
          )}
        </For>
      </ul>
    </>
  );
}
