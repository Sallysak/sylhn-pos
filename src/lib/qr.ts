/**
 * SYLHN POS — Minimal QR Code generator (no dependencies)
 *
 * Generates a compact QR code SVG for a given string.
 * Implements the QR Model 2 algorithm at a basic level — supports byte mode,
 * L error correction, sizes up to ~100 chars (sufficient for receipt IDs).
 *
 * For production use with very long payloads, consider switching to a battle-tested
 * library like `qrcode` — this implementation is intentionally minimal to avoid
 * adding dependencies.
 *
 * Public API:
 *   - qrSvg(text, opts?): string  — returns an SVG string
 *   - qrMatrix(text): Uint8Array  — returns the raw module matrix (1 = dark)
 */

// ===== Galois field arithmetic for Reed-Solomon =====
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

// Generator polynomial for given ECC length
function rsGeneratorPoly(degree: number): number[] {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    poly = poly.map(c => gfMul(c, GF_EXP[i])).concat([0]).map((_, j, arr) =>
      j < arr.length - 1 ? arr[j] ^ (poly[j] !== undefined ? gfMul(poly[j], GF_EXP[i]) : 0) : arr[j]
    );
    // simpler: poly = [poly[i] * x^i for i in range] — recompute cleanly
    const next = new Array(poly.length).fill(0);
    for (let k = 0; k < poly.length; k++) {
      next[k] ^= gfMul(poly[k], GF_EXP[i]);
      if (k + 1 < next.length) next[k + 1] ^= poly[k];
    }
    poly = next;
  }
  return poly;
}

// Encode data + ECC using Reed-Solomon
function rsEncode(data: number[], eccLen: number): number[] {
  if (eccLen === 0) return [];
  const gen = rsGeneratorPoly(eccLen);
  const result = new Array(eccLen).fill(0);
  for (const b of data) {
    const factor = b ^ result[0];
    result.shift();
    result.push(0);
    if (factor !== 0) {
      for (let i = 0; i < gen.length; i++) {
        result[i] ^= gfMul(gen[i], factor);
      }
    }
  }
  return result;
}

// ===== QR code layout for small sizes =====
// For simplicity, we only support version 1-5 with L error correction.
// Version 1: 21x21, version 5: 37x37.
const VERSION_DATA: { version: number; size: number; dataCapacity: number; ecPerBlock: number; dataCodewords: number }[] = [
  { version: 1, size: 21, dataCapacity: 17,  ecPerBlock: 7,  dataCodewords: 19 },
  { version: 2, size: 25, dataCapacity: 32,  ecPerBlock: 10, dataCodewords: 28 },
  { version: 3, size: 29, dataCapacity: 53,  ecPerBlock: 15, dataCodewords: 44 },
  { version: 4, size: 33, dataCapacity: 78,  ecPerBlock: 20, dataCodewords: 64 },
  { version: 5, size: 37, dataCapacity: 106, ecPerBlock: 26, dataCodewords: 86 },
];

function pickVersion(byteLen: number) {
  for (const v of VERSION_DATA) {
    if (v.dataCapacity >= byteLen + 2) return v;  // +2 for mode + length prefix
  }
  return VERSION_DATA[VERSION_DATA.length - 1]; // fallback
}

// ===== Encode text → byte array (UTF-8) =====
function textToBytes(text: string): number[] {
  return Array.from(new TextEncoder().encode(text));
}

// ===== Build the bit stream (byte mode) =====
function buildBitStream(text: string, version: typeof VERSION_DATA[0]): number[] {
  const bytes = textToBytes(text);
  const bits: number[] = [];

  // Mode indicator (byte mode = 0100)
  bits.push(0, 1, 0, 0);

  // Character count (8 bits for version 1-9)
  const len = Math.min(bytes.length, 255);
  for (let i = 7; i >= 0; i--) bits.push((len >> i) & 1);

  // Data
  for (const b of bytes) {
    for (let i = 7; i >= 0; i--) bits.push((b >> i) & 1);
  }

  // Terminator (up to 4 zero bits)
  const totalDataBits = version.dataCodewords * 8;
  for (let i = 0; i < 4 && bits.length < totalDataBits; i++) bits.push(0);

  // Pad to byte boundary
  while (bits.length % 8 !== 0 && bits.length < totalDataBits) bits.push(0);

  // Pad bytes
  const padBytes = [0xEC, 0x11];
  let padIdx = 0;
  while (bits.length < totalDataBits) {
    const pad = padBytes[padIdx % 2];
    padIdx++;
    for (let i = 7; i >= 0; i--) bits.push((pad >> i) & 1);
  }

  return bits;
}

// Convert bits → bytes
function bitsToBytes(bits: number[]): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | (bits[i + j] || 0);
    bytes.push(b);
  }
  return bytes;
}

// ===== Build the module matrix =====
export function qrMatrix(text: string): { matrix: Uint8Array; size: number } {
  const version = pickVersion(text.length);
  const size = version.size;
  const bits = buildBitStream(text, version);
  const dataBytes = bitsToBytes(bits);
  const eccBytes = rsEncode(dataBytes, version.ecPerBlock * Math.ceil(version.dataCodewords / version.dataCodewords));
  // Combine data + ecc (simple: single block)
  const allBytes = dataBytes.concat(eccBytes.slice(0, version.ecPerBlock));

  // Initialize matrix (0 = light, 1 = dark, 2 = reserved for format info)
  const matrix = new Uint8Array(size * size);
  const set = (r: number, c: number, v: number) => { matrix[r * size + c] = v; };
  const get = (r: number, c: number) => matrix[r * size + c];

  // Finder patterns (3 corners)
  const placeFinder = (r0: number, c0: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const rr = r0 + r, cc = c0 + c;
        if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
        const border = r === 0 || r === 6 || c === 0 || c === 6;
        const center = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        const inner = r >= 1 && r <= 5 && c >= 1 && c <= 5;
        set(rr, cc, (border || center) ? 1 : (inner ? 0 : 2));
      }
    }
  };
  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    set(6, i, i % 2 === 0 ? 1 : 0);
    set(i, 6, i % 2 === 0 ? 1 : 0);
  }

  // Reserve format info areas (set to 2)
  for (let i = 0; i < 9; i++) {
    if (get(8, i) === 0) set(8, i, 2);
    if (get(i, 8) === 0) set(i, 8, 2);
  }
  for (let i = 0; i < 8; i++) {
    set(8, size - 1 - i, 2);
    set(size - 1 - i, 8, 2);
  }
  // Dark module
  set(size - 8, 8, 1);

  // Place data bytes in zigzag pattern (skip reserved modules)
  let bitIdx = 0;
  let upward = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--; // skip timing column
    for (let i = 0; i < size; i++) {
      const r = upward ? size - 1 - i : i;
      for (let c = 0; c < 2; c++) {
        const cc = col - c;
        if (get(r, cc) === 0) {
          const byteIdx = bitIdx >> 3;
          const bitInByte = 7 - (bitIdx & 7);
          const bit = byteIdx < allBytes.length ? ((allBytes[byteIdx] >> bitInByte) & 1) : 0;
          set(r, cc, bit);
          bitIdx++;
        }
      }
    }
    upward = !upward;
  }

  // Apply mask pattern 0 (i+j even → flip) — simplest of the 8 patterns
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (get(r, c) === 0 || get(r, c) === 1) {
        if ((r + c) % 2 === 0) set(r, c, get(r, c) ^ 1);
      }
    }
  }

  // Place format info bits (L error correction, mask 0)
  // Format bits: 5 data bits (01 for L) + 10 ECC bits
  // Pre-computed for L + mask 0: 0x77c4 (binary 111011111000100)
  const formatBits = 0x77c4;
  for (let i = 0; i < 15; i++) {
    const bit = (formatBits >> i) & 1;
    // Around top-left
    if (i < 6) set(8, i, bit);
    else if (i < 8) set(8, i + 1, bit);
    else if (i < 9) set(7, 8, bit);
    else set(14 - i, 8, bit);
    // Around bottom-right
    if (i < 8) set(size - 1 - i, 8, bit);
    else set(8, size - 15 + i, bit);
  }

  return { matrix, size };
}

// ===== Render as SVG string =====
export function qrSvg(text: string, opts: { scale?: number; margin?: number; dark?: string; light?: string } = {}): string {
  const scale = opts.scale || 6;
  const margin = opts.margin ?? 4;
  const dark = opts.dark || "#000000";
  const light = opts.light || "#ffffff";

  const { matrix, size } = qrMatrix(text);
  const total = (size + margin * 2) * scale;

  const rects: string[] = [];
  // Background
  rects.push(`<rect width="${total}" height="${total}" fill="${light}"/>`);

  // Dark modules only (smaller SVG)
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (matrix[r * size + c] === 1) {
        const x = (c + margin) * scale;
        const y = (r + margin) * scale;
        rects.push(`<rect x="${x}" y="${y}" width="${scale}" height="${scale}" fill="${dark}"/>`);
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="${total}" viewBox="0 0 ${total} ${total}">${rects.join("")}</svg>`;
}
