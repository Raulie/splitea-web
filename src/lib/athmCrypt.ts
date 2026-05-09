/// AES-CBC encrypt + decrypt for ATH Móvil deep-link
/// tokens. The key + IV were extracted from the decompiled
/// `AESMobile.java` in `ath-movil-qa-2.apk` — they're
/// hardcoded in the app shipped to every device, so they
/// aren't a secret in any meaningful sense; the same
/// key/IV produces and consumes valid tokens for every
/// ATHM customer ID.
///
/// Used to inject an `amount` field into a token's
/// decrypted plaintext at payment time, so the ATHM app
/// (when it supports the field) can prefill the amount.
/// The plaintext shape becomes `type=USER&amount=<X>&
/// value=<customerId>` — `value=` stays last so the
/// older parser's `substring(indexOf("value=") + 6)`
/// extractor still yields a clean recipient ID and the
/// extra `amount=` field is silently ignored.
///
/// Uses Web Crypto's SubtleCrypto API. Async by design —
/// callers must `await`. iOS has the equivalent via
/// CommonCrypto (see `Splitea/Services/ATHMovilQR.swift`).

const KEY_BYTES = new TextEncoder().encode("athmmobileclient");
const IV_BYTES = new TextEncoder().encode("8765432112345678");

/// Cached per-page-load. SubtleCrypto's `importKey` is
/// async and idempotent; doing it once amortizes the cost
/// across multiple encrypt/decrypt calls.
let cachedKeyPromise: Promise<CryptoKey> | null = null;

function getKey(): Promise<CryptoKey> {
  if (cachedKeyPromise) return cachedKeyPromise;
  cachedKeyPromise = crypto.subtle.importKey(
    "raw",
    KEY_BYTES,
    { name: "AES-CBC" },
    false,
    ["encrypt", "decrypt"],
  );
  return cachedKeyPromise;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/\s+/g, "").toLowerCase();
  if (clean.length % 2 !== 0) throw new Error("odd-length hex");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    out[i / 2] = parseInt(clean.substring(i, i + 2), 16);
  }
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i]!.toString(16).padStart(2, "0");
  }
  return out;
}

/// Decrypt an ATHM hex token into its UTF-8 plaintext.
/// Returns null on malformed input / wrong key.
export async function decryptAthmToken(hexToken: string): Promise<string | null> {
  try {
    const key = await getKey();
    const buf = await crypto.subtle.decrypt(
      { name: "AES-CBC", iv: IV_BYTES },
      key,
      hexToBytes(hexToken),
    );
    return new TextDecoder("utf-8").decode(buf);
  } catch {
    return null;
  }
}

/// Encrypt UTF-8 plaintext into an ATHM-compatible hex
/// token. SubtleCrypto's AES-CBC applies PKCS#7 padding
/// automatically, matching CommonCrypto's
/// `kCCOptionPKCS7Padding` we use on iOS.
export async function encryptAthmToken(plaintext: string): Promise<string> {
  const key = await getKey();
  const buf = await crypto.subtle.encrypt(
    { name: "AES-CBC", iv: IV_BYTES },
    key,
    new TextEncoder().encode(plaintext),
  );
  return bytesToHex(new Uint8Array(buf));
}

/// Decrypt the given token, splice an `amount=<value>`
/// field into the plaintext between `type=` and `value=`,
/// and re-encrypt. Returns null if the input doesn't
/// decrypt cleanly or if the plaintext doesn't have the
/// expected `type=…&value=…` shape.
///
/// Field ordering matters: the legacy ATHM Android parser
/// extracts the recipient via `substring(indexOf("value=") + 6)`,
/// which means anything AFTER `value=` ends up in the
/// recipient string. Putting `amount=` BEFORE `value=`
/// keeps that legacy extractor working — the older app
/// silently ignores `amount` while still reading the
/// correct customer ID. A newer ATHM app that does parse
/// `amount=` would prefill the amount field. Worst case
/// (the app doesn't read amount): we degrade gracefully
/// to the no-amount baseline.
///
/// Amount is formatted with 2 fractional digits (`25.99`)
/// to match what's expected when pasted manually into
/// ATHM's amount field.
export async function injectAmountIntoAthmToken(
  hexToken: string,
  amount: number,
): Promise<string | null> {
  const plaintext = await decryptAthmToken(hexToken);
  if (!plaintext) return null;

  const fields = new Map<string, string>();
  for (const pair of plaintext.split("&")) {
    const eq = pair.indexOf("=");
    if (eq < 0) continue;
    fields.set(pair.slice(0, eq), pair.slice(eq + 1));
  }
  const type = fields.get("type");
  const value = fields.get("value");
  if (!type || !value) return null;

  const amountStr = amount.toFixed(2);
  const newPlaintext = `type=${type}&amount=${amountStr}&value=${value}`;
  return await encryptAthmToken(newPlaintext);
}
