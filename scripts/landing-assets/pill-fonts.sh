#!/bin/zsh
set -euo pipefail

USAGE="usage: pill-fonts.sh <BricolageGrotesque-VariableFont_opsz,wdth,wght.ttf> <ArchivoBlack-Regular.ttf> <JetBrainsMono[wght].ttf>"
BRICOLAGE=${1:?$USAGE}
ARCHIVO=${2:?$USAGE}
JETBRAINS=${3:?$USAGE}
DEST=$(cd "$(dirname "$0")/../../public/fonts" && pwd)
TMP=$(mktemp -d)

fonttools varLib.instancer "$BRICOLAGE" wght=600 wdth=100 opsz=12:32 -o "$TMP/brico-600-text.ttf"
pyftsubset "$TMP/brico-600-text.ttf" \
  --unicodes="U+0020-007E,U+00A0-00FF,U+0152-0153,U+0178,U+2018-201E,U+2026,U+2039-203A,U+20AC,U+202F" \
  --layout-features="kern,liga,calt" --flavor=woff2 \
  --output-file="$DEST/bricolage-600-text-latin-v1.woff2"
pyftsubset "$ARCHIVO" \
  --unicodes="U+0020,U+0025,U+002C,U+002E,U+0030-0039,U+00A0,U+202F" \
  --layout-features="kern" --flavor=woff2 \
  --output-file="$DEST/archivo-black-num-v1.woff2"
fonttools varLib.instancer "$JETBRAINS" wght=700 -o "$TMP/jbm-700.ttf"
pyftsubset "$TMP/jbm-700.ttf" --unicodes="U+0030-0039" --layout-features="" --flavor=woff2 \
  --output-file="$DEST/jetbrains-mono-700-num-v1.woff2"
echo "wrote the three bubble fonts to $DEST"
