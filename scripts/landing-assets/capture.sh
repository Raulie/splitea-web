#!/bin/zsh
set -euo pipefail

UDID=${1:?usage: capture.sh <simulator-udid> <out-dir>}
OUT=${2:?usage: capture.sh <simulator-udid> <out-dir>}
APP=com.raulie.Splitea.dev
mkdir -p "$OUT"

xcrun simctl status_bar "$UDID" override --time "9:41" --dataNetwork wifi --wifiMode active --wifiBars 3 \
  --cellularMode active --cellularBars 4 --batteryState discharging --batteryLevel 100

cap() {
  local out=$1; shift
  xcrun simctl launch --terminate-running-process "$UDID" "$APP" "$@" >/dev/null 2>&1
  sleep 7
  xcrun simctl io "$UDID" screenshot --type=png "$out" >/dev/null 2>&1
}

blur_receipt_header() {
  magick "$1" \( +clone -crop 640x300+300+720 -blur 0x14 \) -geometry +300+720 -composite "$1"
}

typeset -A LOC SEG TITLE
LOC=(en en_US es es_MX pt-BR pt_BR fr fr_FR de de_DE it it_IT ja ja_JP ko ko_KR zh-Hans zh_CN zh-Hant zh_TW)
SEG=(en "" es es pt-BR pt-br fr fr de de it it ja ja ko ko zh-Hans zh-hans zh-Hant zh-hant)
TITLE=(en "All Splits" es "Todos los splits" pt-BR "Todos os splits" fr "Tous les partages" de "Alle Splits" \
  it "Tutte le divisioni" ja "すべての分割" ko "모든 정산" zh-Hans "所有分账" zh-Hant "所有分帳")

for c in en es pt-BR fr de it ja ko zh-Hans zh-Hant; do
  s=${SEG[$c]}
  suffix=${s:+-$s}
  base=(-screenshotLang $c -AppleLanguages "($c)" -AppleLocale ${LOC[$c]})
  cap "$OUT/scan$suffix.png" "${base[@]}" -screenshotScreen review -screenshotAutoOrient YES
  blur_receipt_header "$OUT/scan$suffix.png"
  cap "$OUT/taxes$suffix.png" "${base[@]}" -screenshotScreen taxes
  cap "$OUT/settle$suffix.png" "${base[@]}" -screenshotScreen payButton
  cap "$OUT/trip-folder$suffix.png" "${base[@]}" -screenshotScreen library -screenshotFolder YES
  cap "$OUT/fx$suffix.png" "${base[@]}" -screenshotScreen fx
  cap "$OUT/library-grid$suffix.png" "${base[@]}" -screenshotScreen splits -screenshotSplitsTitle "${TITLE[$c]}"
  cap "$OUT/library-list$suffix.png" "${base[@]}" -screenshotScreen library -screenshotMode list
  cap "$OUT/assign$suffix.png" "${base[@]}" -screenshotScreen taxes -screenshotAssign partial
  echo "$c captured"
done
