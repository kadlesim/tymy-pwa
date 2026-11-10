// Generates simple but valid PNG icons (no external dependencies).
// Draws a primary-blue rounded square with a white "calendar" glyph hint.

import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'

function crc32(buf) {
  let c
  const table = []
  for (let n = 0; n < 256; n++) {
    c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff]
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const body = Buffer.concat([typeBuf, data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([len, body, crc])
}

function encodePng(size, pixelFn) {
  const raw = Buffer.alloc((size * 4 + 1) * size)
  let o = 0
  for (let y = 0; y < size; y++) {
    raw[o++] = 0 // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixelFn(x, y, size)
      raw[o++] = r
      raw[o++] = g
      raw[o++] = b
      raw[o++] = a
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}

const BLUE = [13, 110, 253, 255]
const WHITE = [255, 255, 255, 255]
const GREEN = [25, 135, 84, 255]
const TRANSPARENT = [0, 0, 0, 0]

function drawIcon(x, y, size, maskable) {
  const cx = size / 2
  const cy = size / 2
  const radius = size * 0.22
  const inset = maskable ? size * 0.14 : 0

  // rounded rect check
  const inRounded = (px, py, left, top, right, bottom, r) => {
    if (px < left || px > right || py < top || py > bottom) return false
    const nearX = Math.min(Math.max(px, left + r), right - r)
    const nearY = Math.min(Math.max(py, top + r), bottom - r)
    const dx = px - nearX
    const dy = py - nearY
    return dx * dx + dy * dy <= r * r || (px >= left + r && px <= right - r) || (py >= top + r && py <= bottom - r)
  }

  if (!maskable && !inRounded(x, y, 0, 0, size - 1, size - 1, radius)) return TRANSPARENT

  const body = inRounded(
    x, y,
    inset + size * 0.18, inset + size * 0.24,
    size - inset - size * 0.18, size - inset - size * 0.16,
    size * 0.06
  )
  if (!body) return BLUE

  // calendar header bar
  const header = y < inset + size * 0.36 && y > inset + size * 0.24
  if (header) return WHITE

  // three little lines
  const lineY1 = size * 0.5
  const lineY2 = size * 0.62
  const lineX1 = inset + size * 0.26
  const lineX2 = size - inset - size * 0.26
  if (Math.abs(y - lineY1) < size * 0.025 && x > lineX1 && x < lineX2) return BLUE
  if (Math.abs(y - lineY2) < size * 0.025 && x > lineX1 && x < lineX1 + (lineX2 - lineX1) * 0.6) return BLUE

  return WHITE
}

mkdirSync('public/icons', { recursive: true })

const sizes = [72, 96, 128, 144, 152, 192, 384, 512]
for (const size of sizes) {
  const png = encodePng(size, (x, y, s) => drawIcon(x, y, s, false))
  writeFileSync(`public/icons/icon-${size}.png`, png)
}

writeFileSync('public/icons/maskable-512.png', encodePng(512, (x, y, s) => drawIcon(x, y, s, true)))
writeFileSync('public/icons/shortcut-events.png', encodePng(192, (x, y, s) => drawIcon(x, y, s, false)))
writeFileSync('public/icons/shortcut-chat.png', encodePng(192, (x, y, s) => drawIcon(x, y, s, false)))

console.log('Generated PNG icons')
