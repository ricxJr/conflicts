// Generates the MergeScope source icon (1024x1024 PNG) without external deps.
// The Tauri CLI ("tauri icon") derives every platform icon from this file.
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SIZE = 1024;
const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, "..", "apps", "desktop", "src-tauri", "app-icon.png");

const px = new Uint8Array(SIZE * SIZE * 4);

const bg = [22, 24, 29, 255];
const panel = [30, 33, 40, 255];
const blue = [77, 159, 255, 255];
const green = [46, 160, 67, 255];
const red = [248, 81, 73, 255];

function put(x, y, [r, g, b, a]) {
  const i = (y * SIZE + x) * 4;
  px[i] = r;
  px[i + 1] = g;
  px[i + 2] = b;
  px[i + 3] = a;
}

const margin = 64;
const radius = 160;

function insideRoundedRect(x, y) {
  const l = margin;
  const t = margin;
  const r = SIZE - margin;
  const b = SIZE - margin;
  if (x < l || x >= r || y < t || y >= b) return false;
  const cx = Math.max(l + radius, Math.min(x, r - radius));
  const cy = Math.max(t + radius, Math.min(y, b - radius));
  return (
    (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2 ||
    (x >= l + radius && x < r - radius) ||
    (y >= t + radius && y < b - radius)
  );
}

// Merge glyph: two branches (red = current, green = incoming) converging into
// one blue trunk — the MergeScope idea in one shape.
function nearSegment(x, y, x1, y1, x2, y2, width) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / len2));
  const qx = x1 + t * dx;
  const qy = y1 + t * dy;
  return (x - qx) ** 2 + (y - qy) ** 2 <= width ** 2;
}

for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    if (!insideRoundedRect(x, y)) {
      put(x, y, [0, 0, 0, 0]);
      continue;
    }
    let color = bg;
    if (insideRoundedRect(x, y) && (x + y) % 512 < 512) color = panel;

    const w = 46;
    // Left branch (current): from top-left down to center.
    if (nearSegment(x, y, 320, 220, 512, 520, w)) color = red;
    // Right branch (incoming): from top-right down to center.
    if (nearSegment(x, y, 704, 220, 512, 520, w)) color = green;
    // Trunk (result): from center down.
    if (nearSegment(x, y, 512, 500, 512, 810, w)) color = blue;
    // Branch endpoints (commit dots).
    if ((x - 320) ** 2 + (y - 220) ** 2 <= 70 ** 2) color = red;
    if ((x - 704) ** 2 + (y - 220) ** 2 <= 70 ** 2) color = green;
    if ((x - 512) ** 2 + (y - 810) ** 2 <= 70 ** 2) color = blue;

    put(x, y, color);
  }
}

// --- PNG encoding ---
function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256).map((_, n) => {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      return c;
    });
  }
  let crc = -1;
  for (const byte of buf) crc = (crc >>> 8) ^ table[(crc ^ byte) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // RGBA
// scanlines with filter byte 0
const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
for (let y = 0; y < SIZE; y++) {
  raw[y * (SIZE * 4 + 1)] = 0;
  Buffer.from(px.buffer, y * SIZE * 4, SIZE * 4).copy(raw, y * (SIZE * 4 + 1) + 1);
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, png);
console.log(`icon written: ${out} (${png.length} bytes)`);
