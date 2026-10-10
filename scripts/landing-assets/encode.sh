#!/bin/zsh
set -euo pipefail

IN=${1:?usage: encode.sh <captures-dir>}
DEST=$(cd "$(dirname "$0")/../../public/landing" && pwd)

for slug in scan taxes settle trip-dc fx library-grid library-list; do
  for w in 480 720 960; do magick "$IN/$slug.png" -resize ${w}x -quality 62 "$DEST/$slug-v1-$w.avif"; done
  cwebp -quiet -q 82 -sharp_yuv -resize 720 0 "$IN/$slug.png" -o "$DEST/$slug-v1-720.webp"
  for seg in es pt-br fr de it ja ko zh-hans zh-hant; do
    src="$IN/$slug-$seg.png"
    [[ -f $src ]] || continue
    for w in 480 720; do magick "$src" -resize ${w}x -quality 62 "$DEST/$slug-$seg-v1-$w.avif"; done
    cwebp -quiet -q 82 -sharp_yuv -resize 720 0 "$src" -o "$DEST/$slug-$seg-v1-720.webp"
  done
done
echo "encoded into $DEST"
