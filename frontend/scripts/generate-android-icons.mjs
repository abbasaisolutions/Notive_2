/**
 * Generate all Android mipmap launcher icons from the brand square icon.
 * Source: public/images/Square App Icon Version.jpg (500x500+)
 *
 * Android mipmap sizes (launcher icons):
 *   mdpi:    48x48   (ic_launcher.png, ic_launcher_round.png)
 *   hdpi:    72x72
 *   xhdpi:   96x96
 *   xxhdpi:  144x144
 *   xxxhdpi: 192x192
 *
 * Adaptive icon foreground layer (108dp safe zone = 72dp content + 18dp bleed each side):
 *   mdpi:    108x108
 *   hdpi:    162x162
 *   xhdpi:   216x216
 *   xxhdpi:  324x324
 *   xxxhdpi: 432x432
 *
 * The source icon already has the cream background baked in, so we use it for BOTH
 * the flat launcher PNGs and the adaptive foreground layer. The adaptive background
 * color is set in colors.xml (#F8F4ED) to match.
 */

import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const SRC = path.join(ROOT, 'public', 'images', 'Square App Icon Version.jpg');
const RES = path.join(ROOT, 'android', 'app', 'src', 'main', 'res');

// Flat launcher icons (ic_launcher.png + ic_launcher_round.png)
const LAUNCHER_SIZES = [
  { dir: 'mipmap-mdpi',    size: 48 },
  { dir: 'mipmap-hdpi',    size: 72 },
  { dir: 'mipmap-xhdpi',   size: 96 },
  { dir: 'mipmap-xxhdpi',  size: 144 },
  { dir: 'mipmap-xxxhdpi', size: 192 },
];

// Adaptive icon foreground layer per density (placed in mipmap-* directories)
// The icon content is centred inside a 108dp canvas with 18dp safe-zone bleed
const FOREGROUND_SIZES = [
  { dir: 'mipmap-mdpi',    size: 108 },
  { dir: 'mipmap-hdpi',    size: 162 },
  { dir: 'mipmap-xhdpi',   size: 216 },
  { dir: 'mipmap-xxhdpi',  size: 324 },
  { dir: 'mipmap-xxxhdpi', size: 432 },
];

// Also update splash screen (drawable-port-* and drawable-land-*)
const SPLASH_SIZES_PORT = [
  { dir: 'drawable-port-mdpi',    w: 320, h: 480 },
  { dir: 'drawable-port-hdpi',    w: 480, h: 800 },
  { dir: 'drawable-port-xhdpi',   w: 720, h: 1280 },
  { dir: 'drawable-port-xxhdpi',  w: 960, h: 1600 },
  { dir: 'drawable-port-xxxhdpi', w: 1280, h: 1920 },
];

const LOGO_SRC = path.join(ROOT, 'public', 'images', 'notive-logo.jpg');

async function run() {
  const srcInfo = await sharp(SRC).metadata();
  console.log(`Source icon: ${srcInfo.width}x${srcInfo.height}`);

  // --- 1. Flat launcher icons ---
  for (const { dir, size } of LAUNCHER_SIZES) {
    const outDir = path.join(RES, dir);
    fs.mkdirSync(outDir, { recursive: true });

    const outMain = path.join(outDir, 'ic_launcher.png');
    const outRound = path.join(outDir, 'ic_launcher_round.png');

    // Square icon — just resize
    await sharp(SRC).resize(size, size, { fit: 'cover' }).png().toFile(outMain);

    // Round icon — circular clip using SVG mask
    const circle = Buffer.from(
      `<svg><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" /></svg>`
    );
    await sharp(SRC)
      .resize(size, size, { fit: 'cover' })
      .composite([{ input: circle, blend: 'dest-in' }])
      .png()
      .toFile(outRound);

    console.log(`  ${dir}: ic_launcher.png + ic_launcher_round.png (${size}px)`);
  }

  // --- 2. Adaptive icon foreground layer ---
  for (const { dir, size } of FOREGROUND_SIZES) {
    const outDir = path.join(RES, dir);
    fs.mkdirSync(outDir, { recursive: true });

    // Content area = 72/108 of total size (leaves 18dp bleed on each side)
    const contentSize = Math.round((size * 72) / 108);
    const pad = Math.round((size - contentSize) / 2);

    const out = path.join(outDir, 'ic_launcher_foreground.png');
    await sharp(SRC)
      .resize(contentSize, contentSize, { fit: 'cover' })
      .extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 248, g: 244, b: 237, alpha: 1 } })
      .png()
      .toFile(out);

    console.log(`  ${dir}: ic_launcher_foreground.png (${size}px canvas)`);
  }

  // --- 3. Splash screens (portrait) — centred logo on brand background ---
  const logoInfo = await sharp(LOGO_SRC).metadata();
  console.log(`\nSplash logo: ${logoInfo.width}x${logoInfo.height}`);

  for (const { dir, w, h } of SPLASH_SIZES_PORT) {
    const outDir = path.join(RES, dir);
    // Only process if the directory already exists (Capacitor creates them)
    if (!fs.existsSync(outDir)) { fs.mkdirSync(outDir, { recursive: true }); }

    // Logo at ~40% of the shorter dimension, centred
    const logoH = Math.round(Math.min(w, h) * 0.28);
    const logoW = Math.round(logoH * (logoInfo.width / logoInfo.height));

    const splashBg = {
      create: { width: w, height: h, channels: 3, background: { r: 248, g: 244, b: 237 } },
    };

    const resizedLogo = await sharp(LOGO_SRC)
      .resize(logoW, logoH, { fit: 'inside' })
      .png()
      .toBuffer();

    const left = Math.round((w - logoW) / 2);
    const top = Math.round((h - logoH) / 2);

    await sharp(splashBg)
      .composite([{ input: resizedLogo, left, top }])
      .png()
      .toFile(path.join(outDir, 'splash.png'));

    console.log(`  ${dir}: splash.png (${w}x${h})`);
  }

  // Also handle the default drawable splash
  const defaultSplashDir = path.join(RES, 'drawable');
  const defaultLogoH = Math.round(320 * 0.28);
  const defaultLogoW = Math.round(defaultLogoH * (logoInfo.width / logoInfo.height));
  const defaultResized = await sharp(LOGO_SRC)
    .resize(defaultLogoW, defaultLogoH, { fit: 'inside' })
    .png()
    .toBuffer();
  await sharp({
    create: { width: 480, height: 800, channels: 3, background: { r: 248, g: 244, b: 237 } },
  })
    .composite([{ input: defaultResized, left: Math.round((480 - defaultLogoW) / 2), top: Math.round((800 - defaultLogoH) / 2) }])
    .png()
    .toFile(path.join(defaultSplashDir, 'splash.png'));
  console.log(`  drawable: splash.png (480x800 default)`);

  console.log('\nDone. All Android icons and splash screens updated.');
}

run().catch(err => { console.error(err); process.exit(1); });
