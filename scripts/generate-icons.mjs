// Generates the PWA icons + favicons from `logo2.png` (sharp, dev-only dependency).
//
// Run `npm run icons` after replacing the logo. Sizes match the manifest in
// vite.config.ts; `maskable-512.png` keeps the artwork inside the 80 % safe zone.
//
// The normal icons, shortcuts and favicons keep the logo's **transparent background**.
// Two outputs must be opaque: `maskable-512.png` (Android masks it against the launcher
// background) and `apple-touch-icon.png` (iOS composites transparency onto black), so
// those are flattened onto white.

import sharp from 'sharp'
import { mkdirSync } from 'node:fs'

const SOURCE = 'logo2.png'
const BACKGROUND = '#ffffff'

mkdirSync('public/icons', { recursive: true })

/** Transparent pipeline (source alpha preserved). */
const logo = () => sharp(SOURCE)

/** Opaque pipeline, for icons a platform cannot composite. */
const opaqueLogo = () => sharp(SOURCE).flatten({ background: BACKGROUND })

const sizes = [72, 96, 128, 144, 152, 192, 384, 512]

for (const size of sizes) {
  await logo()
    .resize(size, size, { fit: 'contain' })
    .png()
    .toFile(`public/icons/icon-${size}.png`)
}

// Maskable icons need ~10 % padding on every side, otherwise Android crops the artwork.
const maskableInner = 410
const maskablePad = Math.round((512 - maskableInner) / 2)
await opaqueLogo()
  .resize(maskableInner, maskableInner, { fit: 'contain', background: BACKGROUND })
  .extend({
    top: maskablePad,
    bottom: 512 - maskableInner - maskablePad,
    left: maskablePad,
    right: 512 - maskableInner - maskablePad,
    background: BACKGROUND
  })
  .png()
  .toFile('public/icons/maskable-512.png')

for (const shortcut of ['events', 'chat']) {
  await logo()
    .resize(192, 192, { fit: 'contain' })
    .png()
    .toFile(`public/icons/shortcut-${shortcut}.png`)
}

// Browser tab + iOS home screen.
await logo()
  .resize(32, 32, { fit: 'contain' })
  .png()
  .toFile('public/favicon-32.png')
await logo()
  .resize(192, 192, { fit: 'contain' })
  .png()
  .toFile('public/favicon-192.png')
await opaqueLogo()
  .resize(180, 180, { fit: 'contain', background: BACKGROUND })
  .png()
  .toFile('public/apple-touch-icon.png')

console.log('Generated PWA icons and favicons from', SOURCE)
