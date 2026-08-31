#!/bin/bash
# Regenerate all app icons as opaque PNG (App Store requires no alpha channel).
# Usage: ./generate_all_icons.sh
set -euo pipefail

cd "$(dirname "$0")"

TMP_RGBA=$(mktemp -t icon-rgba).png
TMP_JPG=$(mktemp -t icon-flat).jpg
TMP_OPAQUE=$(mktemp -t icon-opaque).png
trap 'rm -f "$TMP_RGBA" "$TMP_JPG" "$TMP_OPAQUE"' EXIT

swift generate_unique_app_icon.swift "$TMP_RGBA"
# Flatten alpha channel by round-tripping through JPEG.
sips -s format jpeg -s formatOptions 100 "$TMP_RGBA" --out "$TMP_JPG" > /dev/null
sips -s format png "$TMP_JPG" --out "$TMP_OPAQUE" > /dev/null

# iOS marketing icon (1024x1024, opaque)
cp "$TMP_OPAQUE" "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"

# Web / PWA icons (kept opaque for consistency)
cp "$TMP_OPAQUE" "www/icons/icon-512.png"
sips -z 512 512 "www/icons/icon-512.png" --out "www/icons/icon-512.png" > /dev/null
sips -z 192 192 "$TMP_OPAQUE" --out "www/icons/icon-192.png" > /dev/null

echo "Generated:"
for f in \
  ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png \
  www/icons/icon-512.png \
  www/icons/icon-192.png; do
  size=$(sips -g pixelWidth -g pixelHeight -g hasAlpha "$f" | tail -n 3 | tr '\n' ' ')
  echo "  $f -> $size"
done
