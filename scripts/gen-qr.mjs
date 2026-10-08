import { writeFileSync } from "node:fs";
import QRCode from "qrcode";

const url = "https://splitea.app/get";
const quiet = 4;
const qr = QRCode.create(url, { errorCorrectionLevel: "M" });
const n = qr.modules.size;
let path = "";
for (let y = 0; y < n; y++) {
  let x = 0;
  while (x < n) {
    if (!qr.modules.data[y * n + x]) { x++; continue; }
    let run = 1;
    while (x + run < n && qr.modules.data[y * n + x + run]) run++;
    path += `M${x + quiet} ${y + quiet}h${run}v1h-${run}z`;
    x += run;
  }
}
const size = n + quiet * 2;
writeFileSync(
  new URL("../src/views/landing/qr.ts", import.meta.url),
  `export const QR_URL = ${JSON.stringify(url)};\nexport const QR_SIZE = ${size};\nexport const QR_PATH = ${JSON.stringify(path)};\n`,
);
console.log(`version ${qr.version}, ${n} modules, ${path.length} chars`);
