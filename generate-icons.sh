#!/bin/bash

# Script to generate Android launcher icons from Naira Bank logo
# Uses ImageMagick to resize the logo to required Android icon sizes

SOURCE_IMAGE="android/app/src/main/res/drawable/nairabank.jpg"
RES_DIR="android/app/src/main/res"

if [ ! -f "$SOURCE_IMAGE" ]; then
  echo "Source image not found: $SOURCE_IMAGE"
  echo "Copying from web demo..."
  cp ../../naira-bank-personal_new/public/nairabank.jpeg "$SOURCE_IMAGE"
fi

echo "Generating Android launcher icons from Naira Bank logo..."

# Generate icons for each density
magick "$SOURCE_IMAGE" -resize 48x48 -background white -gravity center -extent 48x48 "$RES_DIR/mipmap-mdpi/ic_launcher.png"
magick "$SOURCE_IMAGE" -resize 48x48 -background white -gravity center -extent 48x48 "$RES_DIR/mipmap-mdpi/ic_launcher_round.png"

magick "$SOURCE_IMAGE" -resize 72x72 -background white -gravity center -extent 72x72 "$RES_DIR/mipmap-hdpi/ic_launcher.png"
magick "$SOURCE_IMAGE" -resize 72x72 -background white -gravity center -extent 72x72 "$RES_DIR/mipmap-hdpi/ic_launcher_round.png"

magick "$SOURCE_IMAGE" -resize 96x96 -background white -gravity center -extent 96x96 "$RES_DIR/mipmap-xhdpi/ic_launcher.png"
magick "$SOURCE_IMAGE" -resize 96x96 -background white -gravity center -extent 96x96 "$RES_DIR/mipmap-xhdpi/ic_launcher_round.png"

magick "$SOURCE_IMAGE" -resize 144x144 -background white -gravity center -extent 144x144 "$RES_DIR/mipmap-xxhdpi/ic_launcher.png"
magick "$SOURCE_IMAGE" -resize 144x144 -background white -gravity center -extent 144x144 "$RES_DIR/mipmap-xxhdpi/ic_launcher_round.png"

magick "$SOURCE_IMAGE" -resize 192x192 -background white -gravity center -extent 192x192 "$RES_DIR/mipmap-xxxhdpi/ic_launcher.png"
magick "$SOURCE_IMAGE" -resize 192x192 -background white -gravity center -extent 192x192 "$RES_DIR/mipmap-xxxhdpi/ic_launcher_round.png"

echo "✅ Icons generated successfully!"

