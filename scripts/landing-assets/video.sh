#!/bin/zsh
set -euo pipefail

SOURCE=${1:?usage: video.sh <OnboardingContacts.mp4> <capture with a 9:41 status bar, 1206 wide>}
STATUS_FROM=${2:?usage: video.sh <source mp4> <9:41 capture png>}
DEST=$(cd "$(dirname "$0")/../../public/landing" && pwd)
TMP=$(mktemp -d)

magick "$STATUS_FROM" -resize 720x -crop 720x96+0+0 +repage "$TMP/strip.png"
ffmpeg -v error -y -i "$SOURCE" -i "$TMP/strip.png" -filter_complex "[0:v][1:v]overlay=0:0,fps=60,format=yuv420p" \
  -an -c:v libx265 -crf 26 -preset slow -tag:v hvc1 -x265-params log-level=error -movflags +faststart "$DEST/assign-v1.hevc.mp4"
ffmpeg -v error -y -i "$SOURCE" -i "$TMP/strip.png" -filter_complex "[0:v][1:v]overlay=0:0,fps=30,format=yuv420p" \
  -an -c:v libx264 -profile:v high -crf 23 -preset slow -movflags +faststart "$DEST/assign-v1.h264.mp4"
ffmpeg -v error -y -i "$DEST/assign-v1.hevc.mp4" -frames:v 1 "$TMP/first.png"
ffmpeg -v error -y -sseof -0.05 -i "$DEST/assign-v1.hevc.mp4" -frames:v 1 -update 1 "$TMP/last.png"
for name in first last; do
  for w in 480 720 960; do magick "$TMP/$name.png" -resize ${w}x -quality 62 "$DEST/assign-$name-v1-$w.avif"; done
  cwebp -quiet -q 82 -sharp_yuv -resize 720 0 "$TMP/$name.png" -o "$DEST/assign-$name-v1-720.webp"
done
echo "wrote assign-v1 videos and stills into $DEST"
