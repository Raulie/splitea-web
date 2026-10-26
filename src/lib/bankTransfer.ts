/// Web mirror of iOS `BankTransferDetails`
/// (`Splitea/Models/BankTransferDetails.swift`). The payer's
/// bank details ride in `paymentUsernames.bankTransfer` as a
/// JSON string `{"iban":"…","name":"…"}`; the EPC payload and
/// the payment reference must match what the app builds.

export const BANK_TRANSFER_RAW_VALUE = "bankTransfer";

export interface BankTransferDetails {
  name: string;
  iban: string;
}

const IBAN_LENGTHS: Record<string, number> = {
  AD: 24, AE: 23, AL: 28, AT: 20, AZ: 28, BA: 20, BE: 16, BG: 22,
  BH: 22, BI: 27, BR: 29, BY: 28, CH: 21, CR: 22, CY: 28, CZ: 24,
  DE: 22, DJ: 27, DK: 18, DO: 28, EE: 20, EG: 29, ES: 24, FI: 18,
  FK: 18, FO: 18, FR: 27, GB: 22, GE: 22, GI: 23, GL: 18, GR: 27,
  GT: 28, HN: 28, HR: 21, HU: 28, IE: 22, IL: 23, IQ: 23, IS: 26,
  IT: 27, JO: 30, KW: 30, KZ: 20, LB: 28, LC: 32, LI: 21, LT: 20,
  LU: 20, LV: 21, LY: 25, MC: 27, MD: 24, ME: 22, MK: 19, MN: 20,
  MR: 27, MT: 31, MU: 30, NI: 28, NL: 18, NO: 15, OM: 23, PK: 24,
  PL: 28, PS: 29, PT: 25, QA: 29, RO: 24, RS: 22, RU: 33, SA: 24,
  SC: 31, SD: 18, SE: 24, SI: 19, SK: 24, SM: 27, SO: 23, ST: 25,
  SV: 28, TL: 23, TN: 24, TR: 26, UA: 29, VA: 22, VG: 24, XK: 20,
  YE: 30,
};

export function electronicIBAN(raw: string): string {
  const compact = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return compact.startsWith("IBAN") ? compact.slice(4) : compact;
}

export function isValidIBAN(raw: string): boolean {
  const iban = electronicIBAN(raw);
  const expected = IBAN_LENGTHS[iban.slice(0, 2)];
  if (!expected || iban.length !== expected || !/^\d\d$/.test(iban.slice(2, 4))) {
    return false;
  }
  let remainder = 0;
  for (const ch of iban.slice(4) + iban.slice(0, 4)) {
    const code = ch.charCodeAt(0);
    if (code >= 48 && code <= 57) {
      remainder = (remainder * 10 + (code - 48)) % 97;
    } else {
      remainder = (remainder * 100 + (code - 55)) % 97;
    }
  }
  return remainder === 1;
}

export function formattedIBAN(iban: string): string {
  return electronicIBAN(iban).replace(/(.{4})(?=.)/g, "$1 ");
}

export function bankTransferDetails(
  paymentUsernames: Record<string, string> | null | undefined,
): BankTransferDetails | null {
  const raw = paymentUsernames?.[BANK_TRANSFER_RAW_VALUE];
  if (typeof raw !== "string" || raw.length === 0) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const { name, iban } = parsed as { name?: unknown; iban?: unknown };
  if (typeof name !== "string" || typeof iban !== "string") return null;
  const cleanName = name.replace(/[\r\n]+/g, " ").trim().slice(0, 70);
  const cleanIBAN = electronicIBAN(iban);
  if (!cleanName || !isValidIBAN(cleanIBAN)) return null;
  return { name: cleanName, iban: cleanIBAN };
}

const LATIN_EXPANSIONS: Record<string, string> = {
  "Ł": "L", "ł": "l", "ß": "ss", "Ø": "O", "ø": "o", "Æ": "AE", "æ": "ae", "Œ": "OE", "œ": "oe",
  "Đ": "D", "đ": "d", "Ð": "D", "ð": "d", "Þ": "Th", "þ": "th", "ı": "i", "&": "+",
};

function isLatinOnly(text: string): boolean {
  for (const ch of text) {
    if (!/\p{Alphabetic}/u.test(ch)) continue;
    const code = ch.codePointAt(0)!;
    if (!(code <= 0x024f || (code >= 0x1e00 && code <= 0x1eff))) return false;
  }
  return true;
}

function sepaText(text: string): string {
  const expanded = Array.from(text, (ch) => LATIN_EXPANSIONS[ch] ?? ch).join("");
  const folded = expanded.normalize("NFKD").replace(/\p{M}/gu, "");
  return folded
    .replace(/[^A-Za-z0-9/\-?:().,'+ ]/g, " ")
    .split(" ")
    .filter(Boolean)
    .join(" ");
}

export function bankTransferReference(merchantName: string | null | undefined): string {
  const raw = merchantName ?? "";
  const merchant = isLatinOnly(raw) ? sepaText(raw) : "";
  return (merchant ? `Splitea: ${merchant}` : "Splitea").slice(0, 140);
}

export function epcPayload(
  details: BankTransferDetails,
  amount: number,
  currencyCode: string,
  reference: string,
): string | null {
  if (currencyCode.toUpperCase() !== "EUR") return null;
  if (!(amount >= 0.01 && amount <= 999999999.99)) return null;
  const payload = [
    "BCD", "002", "1", "SCT", "",
    details.name,
    details.iban,
    `EUR${amount.toFixed(2)}`,
    "", "",
    reference.slice(0, 140),
  ].join("\n");
  return new TextEncoder().encode(payload).length <= 331 ? payload : null;
}

export interface QRPath {
  size: number;
  path: string;
}

export async function qrPath(payload: string): Promise<QRPath> {
  const { default: QRCode } = await import("qrcode");
  const quiet = 4;
  const qr = QRCode.create(payload, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  let path = "";
  for (let y = 0; y < n; y++) {
    let x = 0;
    while (x < n) {
      if (!qr.modules.data[y * n + x]) {
        x++;
        continue;
      }
      let run = 1;
      while (x + run < n && qr.modules.data[y * n + x + run]) run++;
      path += `M${x + quiet} ${y + quiet}h${run}v1h-${run}z`;
      x += run;
    }
  }
  return { size: n + quiet * 2, path };
}
