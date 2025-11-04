#!/usr/bin/env node

/**
 * Script to generate Android launcher icons from a source image
 * Uses the nairabank.jpeg logo from the web demo
 */

const fs = require('fs');
const path = require('path');

// Icon sizes for different densities
const iconSizes = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
};

const sourceImage = path.join(__dirname, 'android/app/src/main/res/drawable/nairabank.png');
const resDir = path.join(__dirname, 'android/app/src/main/res');

console.log('Generating Android launcher icons...');
console.log('Note: This script copies the source image. For proper icon generation,');
console.log('please use a tool like ImageMagick or Android Asset Studio online.');

// For now, we'll create a simple placeholder script
// The actual icon generation should be done with proper image processing tools
Object.keys(iconSizes).forEach((folder) => {
  const folderPath = path.join(resDir, folder);
  const launcherPath = path.join(folderPath, 'ic_launcher.png');
  const launcherRoundPath = path.join(folderPath, 'ic_launcher_round.png');
  
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }
  
  // Copy source image if it exists, otherwise create placeholder files
  if (fs.existsSync(sourceImage)) {
    // Note: In production, you'd want to resize the image properly
    // For now, we keep the existing icons but document what should be done
    console.log(`Would generate ${iconSizes[folder]}x${iconSizes[folder]} icons for ${folder}`);
  }
});

console.log('\nTo properly generate icons:');
console.log('1. Use Android Asset Studio: https://romannurik.github.io/AndroidAssetStudio/icons-launcher.html');
console.log('2. Or use ImageMagick: convert nairabank.jpeg -resize 192x192 ic_launcher.png');
console.log('3. Then copy to appropriate mipmap folders');

