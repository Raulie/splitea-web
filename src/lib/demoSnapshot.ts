import type { ReceiptSnapshot } from "../types/snapshot";

/// Fixture snapshot for the marketing landing page.
///
/// The landing hero mounts the REAL recipient UI (the same
/// components `/r/<shareID>` renders) against this object
/// instead of `fetchSnapshot`, so the screenshot on
/// splitea.app can never drift from the shipped product. It
/// is plain data — no network, no WebSocket, no live relay.
///
/// Invariants worth preserving when editing:
///
///   • **The money ties out.** Item prices sum to $118.00.
///     Food is taxed at 7% and the sangría at 11.5%, Puerto
///     Rico's split between prepared food and alcohol. Every
///     `taxAmount` is that item's price × its rate rounded
///     half-up, except `Arroz con gandules` which gives back the
///     one reconciliation cent so the six amounts sum EXACTLY to
///     `printedTaxTotal` ($9.43 = 7% of the $92.00 food subtotal
///     plus 11.5% of $26.00), the same shape iOS's reconciler
///     produces. `taxRate` is null because the rates are mixed,
///     so the summary reads "Tax", never "Tax (11.5%)".
///     Renders as: Subtotal $118.00 · Tax $9.43 ·
///     Tip (18%) $21.24 · Total $148.67.
///
///   • **Assignments are deliberately PARTIAL.** Four of the
///     six items are claimed, two are not. That keeps the hero
///     in items-first mode (`ItemsView`'s `captureMode` only
///     picks summary-first when every item is assigned) and
///     exercises all four of `ItemRow`'s assignment
///     indicators in one screenful: a single avatar, a
///     two-avatar stack, the everyone glyph, and the
///     empty circle.
///
///   • **`receiptImageBase64` is null on purpose.** Embedding
///     a photo would put a multi-hundred-KB data URI in the
///     JS bundle. Null degrades cleanly: `ReceiptInfoCard`
///     drops the receipt-icon button, and `SavedReceiptView`
///     shows the settlement ring without the Summary/Receipt
///     control.
///
///   • **`avatarUrl` points at self-hosted photos** in
///     `/landing/` (the faces from the App Store screenshots),
///     so the page makes no request to `avatars.splitea.app`.
///
///   • **Ids are hardcoded and stable.** The breakdown math
///     places leftover cents by lowercased id order, so
///     changing an id silently shifts a penny between people.
export const DEMO_SNAPSHOT: ReceiptSnapshot = {
  version: 1,
  snapshotSeq: 0,
  receipt: {
    id: "7D3E9A15-2C68-4B70-A9D4-6E015F82C3B7",
    merchantName: "Casa Sofía",
    // 2026-08-15 17:34 UTC. Renders as a 1:34 PM lunch in
    // San Juan / New York and a 7:34 PM dinner in Madrid —
    // a plausible hour in both markets, unlike an evening
    // Atlantic timestamp that lands after 2 AM in Europe.
    receiptDate: 1786815240000,
    tipType: "percentage",
    tipValue: 18,
    tipPostTax: false,
    currencyCode: "USD",
    receiptImageBase64: null,
    receiptMimeType: "image/jpeg",
    warningCodes: [],
    taxRoundingMethod: "on_subtotal_half_up",
    taxInclusive: false,
    taxRate: null,
    printedTaxTotal: 9.43,
    payerPhoneNumber: "+17875550142",
  },
  items: [
    {
      id: "1D7B23F0-6C94-4E15-8A72-3B60D1F84E29",
      itemDescription: "Mofongo de pulpo",
      price: 27,
      tax: 7,
      taxAmount: 1.89,
      sortOrder: 0,
      warningCodes: [],
    },
    {
      id: "2E85C40A-7D16-4B98-A3E5-9C41F27B5D63",
      itemDescription: "Chillo entero frito",
      price: 34,
      tax: 7,
      taxAmount: 2.38,
      sortOrder: 1,
      warningCodes: [],
    },
    {
      id: "0C4A17E9-58B2-4D63-9F81-7A25E0B3C46D",
      itemDescription: "Tostones",
      price: 11.5,
      tax: 7,
      taxAmount: 0.81,
      sortOrder: 2,
      warningCodes: [],
    },
    {
      // Carries the reconciliation cent: 8.50 × 7% is 0.595,
      // which would round half-up to 0.60. Baked down to 0.59
      // so the six amounts sum to printedTaxTotal.
      id: "3F96D51B-8E27-4CA9-B4F6-0D52A38C6E74",
      itemDescription: "Arroz con gandules",
      price: 8.5,
      tax: 7,
      taxAmount: 0.59,
      sortOrder: 3,
      warningCodes: [],
    },
    {
      id: "4A07E62C-9F38-4DBA-8517-1E63B49D7F85",
      itemDescription: "Sangría de la casa",
      price: 26,
      tax: 11.5,
      taxAmount: 2.99,
      sortOrder: 4,
      warningCodes: [],
    },
    {
      id: "5B18F73D-A049-4EC1-9628-2F74C5AE8096",
      itemDescription: "Flan de queso",
      price: 11,
      tax: 7,
      taxAmount: 0.77,
      sortOrder: 5,
      warningCodes: [],
    },
  ],
  contacts: [
    {
      // The share author and the person who fronted the bill —
      // `payerPhoneNumber` matches this number, so `ContactsRow`
      // shows the credit-card glyph beside her name and
      // `SavedReceiptView` offers "Pay Marisol".
      id: "3C1D5E80-9A64-4F27-8B0E-15D2C7A46E93",
      phoneNumber: "+17875550142",
      contactIdentifier: null,
      fullName: "Marisol Vega",
      isUserContact: true,
      // Venmo only, deliberately. An `athMovil` entry would have
      // to be 32-hex AES ciphertext to satisfy
      // `extractAthmToken` (payProviders.ts:146); anything else
      // falls back to a bare third-party S3 URL, i.e. a dead
      // outbound link on the marketing page. One provider is
      // enough for any Pay-sheet shot and it halves the
      // `/p/<slug>/icon.png` requests PayMenuSheet would fire.
      paymentUsernames: {
        venmo: "marisol-vega",
      },
      avatarUrl: "/landing/avatar-marisol-v1.webp",
      shortId: 1,
      paid: false,
      paidAt: null,
      confirmed: false,
      confirmedAt: null,
    },
    {
      id: "6B84A2F1-0D37-4C59-9E28-4A61FB03D7C5",
      phoneNumber: "+17875550168",
      // Null, like the payer's: no web consumer reads
      // `contactIdentifier` (it is the iOS CNContact id), and a
      // populated value invites a future reader to assume it is
      // load-bearing.
      contactIdentifier: null,
      fullName: "Andrés Colón",
      isUserContact: false,
      paymentUsernames: null,
      avatarUrl: "/landing/avatar-andres-v1.webp",
      shortId: 2,
      paid: false,
      paidAt: null,
      confirmed: false,
      confirmedAt: null,
    },
    {
      id: "A57E9C42-1B60-48D3-B7F5-8E39026CA184",
      phoneNumber: "+19395550113",
      contactIdentifier: null,
      fullName: "Nina Bermúdez",
      isUserContact: false,
      paymentUsernames: null,
      avatarUrl: "/landing/avatar-nina-v1.webp",
      shortId: 3,
      paid: false,
      paidAt: null,
      confirmed: false,
      confirmedAt: null,
    },
  ],
  assignments: [
    // Tostones — shared by two of three: renders a two-avatar stack.
    {
      id: "8E4F0B26-3D79-4A81-BA05-7F126C93D4E8",
      itemId: "0C4A17E9-58B2-4D63-9F81-7A25E0B3C46D",
      contactId: "3C1D5E80-9A64-4F27-8B0E-15D2C7A46E93",
    },
    {
      id: "9F501C37-4E8A-4B92-8C16-0A237D04E5F9",
      itemId: "0C4A17E9-58B2-4D63-9F81-7A25E0B3C46D",
      contactId: "A57E9C42-1B60-48D3-B7F5-8E39026CA184",
    },
    // Mofongo — Marisol alone: renders her initials avatar.
    {
      id: "A0612D48-5F9B-4CA3-9D27-1B348E15F60A",
      itemId: "1D7B23F0-6C94-4E15-8A72-3B60D1F84E29",
      contactId: "3C1D5E80-9A64-4F27-8B0E-15D2C7A46E93",
    },
    // Chillo — Andrés alone.
    {
      id: "B1723E59-60AC-4DB4-AE38-2C459F260B1C",
      itemId: "2E85C40A-7D16-4B98-A3E5-9C41F27B5D63",
      contactId: "6B84A2F1-0D37-4C59-9E28-4A61FB03D7C5",
    },
    // Sangría — all three: renders the person.3.fill everyone glyph.
    {
      id: "C2834F6A-71BD-4EC5-BF49-3D56A0371C2D",
      itemId: "4A07E62C-9F38-4DBA-8517-1E63B49D7F85",
      contactId: "3C1D5E80-9A64-4F27-8B0E-15D2C7A46E93",
    },
    {
      id: "D3945A7B-82CE-4FD6-8051-4E67B1482D3E",
      itemId: "4A07E62C-9F38-4DBA-8517-1E63B49D7F85",
      contactId: "6B84A2F1-0D37-4C59-9E28-4A61FB03D7C5",
    },
    {
      id: "E4A56B8C-93DF-40E7-9162-5F78C2593E4F",
      itemId: "4A07E62C-9F38-4DBA-8517-1E63B49D7F85",
      contactId: "A57E9C42-1B60-48D3-B7F5-8E39026CA184",
    },
    // Arroz con gandules and Flan de queso stay unassigned —
    // the empty-circle indicator, and the reason the hero
    // stays in items-first (editor) mode.
  ],
};

/// Fresh deep copy of `DEMO_SNAPSHOT`.
///
/// `createSnapshotStore` hands the snapshot straight to Solid's
/// `createStore`, whose proxy writes THROUGH to the object it
/// was given. Passing the module const directly would let a
/// visitor's taps permanently mutate the fixture for the rest
/// of the page session, so anything that mounts the live UI
/// should mount a copy. `structuredClone` is available in every
/// browser the SPA targets; the JSON round-trip is a defensive
/// fallback (the fixture is pure JSON-safe data either way).
export function demoSnapshot(): ReceiptSnapshot {
  return typeof structuredClone === "function"
    ? structuredClone(DEMO_SNAPSHOT)
    : (JSON.parse(JSON.stringify(DEMO_SNAPSHOT)) as ReceiptSnapshot);
}
