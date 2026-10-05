/**
 * Rasterizes the `BrandMark` geometry with supersampling and encodes PNGs with node:zlib, so no
 * image tooling is required.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUTS = [...[16, 32, 48, 128].map((size) => ({ size, dir: 'public/icons' })), { size: 512, dir: 'store' }];
const SAMPLES = 4;

// Geometry in a 32×32 design space, identical to the BrandMark SVG.
const TILE_RADIUS = 8;
const MOON = { x: 15.5, y: 16.5, r: 8.5 };
const CUTOUT = { x: 20.5, y: 12.5, r: 7.2 };
const TOP = [0x2c, 0x2e, 0x33];
const BOTTOM = [0x16, 0x17, 0x1a];
const MOON_COLOR = [0xee, 0xf0, 0xf4];

const insideRoundedRect = (x, y, size, radius) => {
  const cx = Math.min(Math.max(x, radius), size - radius);
  const cy = Math.min(Math.max(y, radius), size - radius);
  return x >= 0 && y >= 0 && x <= size && y <= size && (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
};

const insideCircle = (x, y, c) => (x - c.x) ** 2 + (y - c.y) ** 2 <= c.r ** 2;

const render = (size) => {
  const scale = 32 / size;
  const pixels = Buffer.alloc(size * size * 4);

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let tile = 0;
      let moon = 0;
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const x = (px + (sx + 0.5) / SAMPLES) * scale;
          const y = (py + (sy + 0.5) / SAMPLES) * scale;
          if (!insideRoundedRect(x, y, 32, TILE_RADIUS)) continue;
          tile++;
          if (insideCircle(x, y, MOON) && !insideCircle(x, y, CUTOUT)) moon++;
        }
      }

      const total = SAMPLES * SAMPLES;
      const t = py / Math.max(1, size - 1);
      const base = TOP.map((top, i) => top + (BOTTOM[i] - top) * t);
      const mix = tile ? moon / tile : 0;
      const offset = (py * size + px) * 4;
      for (let i = 0; i < 3; i++) pixels[offset + i] = Math.round(base[i] + (MOON_COLOR[i] - base[i]) * mix);
      pixels[offset + 3] = Math.round((tile / total) * 255);
    }
  }
  return pixels;
};

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

const crc32 = (buffer) => {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};

const chunk = (type, data) => {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
};

const encodePng = (size, rgba) => {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  const rows = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) rgba.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

for (const { size, dir } of OUTPUTS) {
  const outDir = resolve(root, dir);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, `icon${size}.png`), encodePng(size, render(size)));
}
