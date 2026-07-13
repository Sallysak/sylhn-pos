#!/usr/bin/env node
/**
 * Generates simple PNG icons for the PWA manifest.
 * Uses a green emerald background with a white "S" shape.
 * No external dependencies — generates PNG bytes manually.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createPNG(size) {
  const width = size;
  const height = size;
  const pixels = Buffer.alloc(width * height * 4);

  // Emerald gradient (#059669 → #0d9488)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const t = y / height;
      pixels[i]     = Math.round(5 + (13 - 5) * t);
      pixels[i + 1] = Math.round(150 + (148 - 150) * t);
      pixels[i + 2] = Math.round(105 + (136 - 105) * t);
      pixels[i + 3] = 255;
    }
  }

  // Draw a white "S" shape using arcs
  const cx = width / 2;
  const cy = height / 2;
  const r = size * 0.32;
  const thickness = size * 0.13;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const dx = x - cx;
      const dy = y - cy;

      const topArc = (dy < -thickness * 0.5) && Math.abs(Math.sqrt(dx * dx + (dy + r * 0.5) * (dy + r * 0.5)) - r) < thickness;
      const botArc = (dy > thickness * 0.5) && Math.abs(Math.sqrt(dx * dx + (dy - r * 0.5) * (dy - r * 0.5)) - r) < thickness;
      const midBar = Math.abs(dy) < thickness * 0.5 && Math.abs(dx) < r * 0.9;

      if (topArc || botArc || midBar) {
        pixels[i] = 255;
        pixels[i + 1] = 255;
        pixels[i + 2] = 255;
        pixels[i + 3] = 255;
      }
    }
  }

  // ===== Encode as PNG =====
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

  function crc32(buf) {
    const table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
    let crc = -1;
    for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ -1) >>> 0;
  }

  function chunk(type, data) {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, "ascii");
    const crcInput = Buffer.concat([typeBuf, data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(crcInput), 0);
    return Buffer.concat([length, typeBuf, data, crc]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const filtered = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    filtered[y * (stride + 1)] = 0;
    pixels.copy(filtered, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const idat = zlib.deflateSync(filtered);

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const PUBLIC_DIR = path.join(__dirname, "..", "public");
const sizes = [
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  { name: "icon-maskable-512.png", size: 512 },
];

for (const { name, size } of sizes) {
  const png = createPNG(size);
  fs.writeFileSync(path.join(PUBLIC_DIR, name), png);
  console.log(`Generated ${name} (${size}x${size}, ${png.length} bytes)`);
}
