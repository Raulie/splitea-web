import { createResource, createSignal, For, Show } from "solid-js";
import { ChevronGlyph } from "./ChevronGlyph";
import { formatCurrency } from "../lib/format";
import { t } from "../lib/i18n";
import {
  bankTransferReference,
  epcPayload,
  formattedIBAN,
  qrPath,
  type BankTransferDetails,
} from "../lib/bankTransfer";
import type { PayCandidate } from "./PayMenuSheet";
import type { MessageKey } from "../locales/en";

export function BankTransferIcon(props: { size: number }) {
  return (
    <svg
      viewBox="0 0 1024 1024"
      width={props.size}
      height={props.size}
      aria-hidden="true"
      class="shrink-0 rounded-[8px]"
    >
      <rect width="1024" height="1024" fill="#127A63" />
      <path
        d="M494.5 205.2C505.4 199.4 518.6 199.4 529.5 205.2L812.3 355.8C838.9 370 828.8 410 798.6 410H225.4C195.2 410 185.1 370 211.7 355.8L494.5 205.2Z"
        fill="white"
      />
      <circle cx="512" cy="322" r="34" fill="#127A63" />
      <rect x="250" y="446" width="76" height="262" rx="18" fill="white" />
      <rect x="398" y="446" width="76" height="262" rx="18" fill="white" />
      <rect x="550" y="446" width="76" height="262" rx="18" fill="white" />
      <rect x="698" y="446" width="76" height="262" rx="18" fill="white" />
      <rect x="210" y="740" width="604" height="58" rx="22" fill="white" />
    </svg>
  );
}

interface BankTransferStageProps {
  details: BankTransferDetails;
  candidate: PayCandidate;
  currencyCode: string;
  merchantName: string | null;
  onBack: () => void;
  onCopy: () => void;
  onMarkPaid: (contactId: string) => void;
  onDismiss: () => void;
}

interface DetailRow {
  id: string;
  label: MessageKey;
  value: string;
  copyValue: string;
  ltr?: boolean;
  mono?: boolean;
}

function plainAmount(amount: number, currencyCode: string): string {
  const digits =
    currencyCode.toUpperCase() === "HUF"
      ? 0
      : new Intl.NumberFormat(undefined, { style: "currency", currency: currencyCode })
          .resolvedOptions().maximumFractionDigits ?? 2;
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    useGrouping: false,
  }).format(amount);
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }
}

export function BankTransferStage(props: BankTransferStageProps) {
  const [copied, setCopied] = createSignal<string | null>(null);
  const [justMarked, setJustMarked] = createSignal(false);
  const reference = () => bankTransferReference(props.merchantName);
  const payload = () =>
    epcPayload(props.details, props.candidate.amount, props.currencyCode, reference());
  const [qr] = createResource(payload, (p) => qrPath(p).catch(() => null));

  const rows = (): DetailRow[] => [
    {
      id: "name",
      label: "bankTransferAccountHolderLabel",
      value: props.details.name,
      copyValue: props.details.name,
    },
    {
      id: "iban",
      label: "bankTransferIbanLabel",
      value: formattedIBAN(props.details.iban),
      copyValue: props.details.iban,
      ltr: true,
      mono: true,
    },
    {
      id: "amount",
      label: "bankTransferAmountLabel",
      value: formatCurrency(props.candidate.amount, props.currencyCode),
      copyValue: plainAmount(props.candidate.amount, props.currencyCode),
    },
    {
      id: "reference",
      label: "bankTransferReferenceLabel",
      value: reference(),
      copyValue: reference(),
      ltr: true,
    },
  ];

  let resetTimer: number | undefined;
  async function copy(row: DetailRow) {
    if (!(await copyText(row.copyValue))) return;
    props.onCopy();
    setCopied(row.id);
    window.clearTimeout(resetTimer);
    resetTimer = window.setTimeout(() => setCopied(null), 1500);
  }

  return (
    <>
      <div class="relative px-5 pt-2 pb-1 text-center">
        <button
          type="button"
          class="absolute start-3 top-2 flex items-center gap-1 text-ios-body text-ios-blue active:opacity-60 transition-opacity"
          onClick={() => props.onBack()}
        >
          <ChevronGlyph size={15} class="rtl-mirror" />
          {t("backButton")}
        </button>
        <h3 class="text-ios-headline text-ios-label">{t("bankTransferProviderName")}</h3>
        <p class="text-ios-title-2 font-bold text-ios-label tabular-nums mt-2">
          {formatCurrency(props.candidate.amount, props.currencyCode)}
        </p>
      </div>

      <Show when={qr()}>
        {(code) => (
          <div class="flex flex-col items-center px-5 pt-2">
            <div class="rounded-[18px] bg-white p-3 shadow-sm">
              <svg
                viewBox={`0 0 ${code().size} ${code().size}`}
                width="200"
                height="200"
                role="img"
                aria-label={t("bankTransferQrLabel")}
                shape-rendering="crispEdges"
              >
                <path d={code().path} fill="#000" />
              </svg>
            </div>
            <p class="text-ios-footnote text-ios-label-secondary mt-2 text-center">
              {t("bankTransferScanHint")}
            </p>
          </div>
        )}
      </Show>

      <ul class="px-2 pt-3">
        <For each={rows()}>
          {(row, i) => (
            <li>
              <button
                type="button"
                class="w-full flex items-center gap-3 px-3 py-2.5 rounded-ios-card-inner active:bg-ios-card-hi transition-colors text-start"
                aria-label={t("bankTransferCopyLabel", { label: t(row.label) })}
                onClick={() => void copy(row)}
              >
                <span class="flex-1 min-w-0">
                  <span class="block text-ios-footnote text-ios-label-secondary">{t(row.label)}</span>
                  <span
                    class="block text-ios-body text-ios-label break-words"
                    classList={{ "font-mono": row.mono }}
                    dir={row.ltr ? "ltr" : undefined}
                  >
                    {row.value}
                  </span>
                </span>
                <span
                  class="shrink-0 w-5 h-5"
                  classList={{
                    "text-ios-blue": copied() !== row.id,
                    "text-ios-green": copied() === row.id,
                  }}
                >
                  <Show when={copied() === row.id} fallback={<CopyGlyph />}>
                    <CheckGlyph />
                  </Show>
                </span>
                <span class="sr-only" aria-live="polite">
                  {copied() === row.id ? t("bankTransferCopiedLabel") : ""}
                </span>
              </button>
              <Show when={i() < rows().length - 1}>
                <div class="ios-hairline mx-3" />
              </Show>
            </li>
          )}
        </For>
      </ul>
      <p class="px-5 pt-1 text-ios-footnote text-ios-label-secondary text-center">
        {t("bankTransferCopyHint")}
      </p>

      <Show when={props.candidate.settlementState === "owes"}>
        <div class="ios-hairline mx-5 mt-3" />
        <div class="px-2 pt-2 pb-3">
          <button
            type="button"
            class="w-full px-3 py-3 text-center text-ios-body text-ios-blue active:opacity-60 transition-opacity"
            onClick={() => {
              if (justMarked()) return;
              setJustMarked(true);
              props.onMarkPaid(props.candidate.contactId);
              props.onDismiss();
            }}
          >
            {t("markAsPaidButton")}
          </button>
        </div>
      </Show>
      <Show when={props.candidate.settlementState !== "owes"}>
        <div class="pb-4" />
      </Show>
    </>
  );
}

function CheckGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

function CopyGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
      <rect x="8.5" y="8.5" width="11" height="12" rx="2.5" />
      <path d="M15.5 8.5V6a2.5 2.5 0 0 0-2.5-2.5H6A2.5 2.5 0 0 0 3.5 6v8A2.5 2.5 0 0 0 6 16.5h2.5" />
    </svg>
  );
}
