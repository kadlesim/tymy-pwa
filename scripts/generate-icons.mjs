// Generates the PWA icons + favicons from `logo.png` (sharp, dev-only dependency).
//
// Run `npm run icons` after replacing the logo. Sizes match the manifest in
// vite.config.ts; `maskable-512.png` keeps the artwork inside the 80 % safe zone.

import sharp from 'sharp'
import { mkdirSync } from 'node:fs'

const SOURCE = 'logo.png'
const BACKGROUND = '#ffffff'

mkdirSync('public/icons', { recursive: true })

const sizes = [72, 96, 128, 144, 152, 192, 384, 512]

for (const size of sizes) {
  await sharp(SOURCE)
    .resize(size, size, { fit: 'contain', background: BACKGROUND })
    .png()
    .toFile(`public/icons/icon-${size}.png`)
}

// Maskable icons need ~10 % padding on every side, otherwise Android crops the artwork.
const maskableInner = 410
const maskablePad = Math.round((512 - maskableInner) / 2)
await sharp(SOURCE)
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
  await sharp(SOURCE)
    .resize(192, 192, { fit: 'contain', background: BACKGROUND })
    .png()
    .toFile(`public/icons/shortcut-${shortcut}.png`)
}

// Browser tab + iOS home screen.
await sharp(SOURCE)
  .resize(32, 32, { fit: 'contain', background: BACKGROUND })
  .png()
  .toFile('public/favicon-32.png')
await sharp(SOURCE)
  .resize(192, 192, { fit: 'contain', background: BACKGROUND })
  .png()
  .toFile('public/favicon-192.png')
await sharp(SOURCE)
  .resize(180, 180, { fit: 'contain', background: BACKGROUND })
  .png()
  .toFile('public/apple-touch-icon.png')

console.log('Generated PWA icons and favicons from', SOURCE)
