#!/bin/zsh
set -euo pipefail

VARIABLE_TTF=${1:?usage: font.sh <BricolageGrotesque-VariableFont_opsz,wdth,wght.ttf> <version>}
VERSION=${2:?usage: font.sh <variable ttf> <version, e.g. v3>}
DEST=$(cd "$(dirname "$0")/../../public/fonts" && pwd)
TMP=$(mktemp -d)

fonttools varLib.instancer "$VARIABLE_TTF" wght=800 wdth=100 opsz=96 -o "$TMP/brico-800-96.ttf"
pyftsubset "$TMP/brico-800-96.ttf" \
  --unicodes="U+0020-007E,U+00A0-00FF,U+0152-0153,U+0178,U+2018-201E,U+2026,U+2039-203A,U+20AC,U+202F" \
  --layout-features="kern,liga,calt" --flavor=woff2 \
  --output-file="$DEST/bricolage-800-latin-$VERSION.woff2"
cp "$TMP/brico-800-96.ttf" "$(dirname "$0")/brico-800-96.ttf"
echo "wrote $DEST/bricolage-800-latin-$VERSION.woff2 and the instanced TTF used by og.py"
