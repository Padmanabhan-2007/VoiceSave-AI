import fs from 'fs';
import zlib from 'zlib';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function crc32(buf) {
  let table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
    table[i] = c;
  }
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
  return (crc ^ (-1)) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([len, typeAndData, crc]);
}

function generatePng(size) {
  const width = size;
  const height = size;
  const rowBytes = 1 + width * 4;
  const raw = Buffer.alloc(height * rowBytes);

  const cx = width / 2;
  const cy = height / 2;
  const radius = width * 0.46;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowBytes;
    raw[rowOffset] = 0; // filter None
    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= radius) {
        // Circle background: VoiceSave AI Dark Product Surface (#181715 -> #252320)
        const t = (x + y) / (width + height);
        const r = Math.round(24 * (1 - t) + 37 * t);
        const g = Math.round(23 * (1 - t) + 35 * t);
        const b = Math.round(21 * (1 - t) + 32 * t);

        // Sound waves / VoiceSave audio waveform mark overlay
        const barWidth = Math.max(1, Math.round(width * 0.08));
        const spacing = Math.max(2, Math.round(width * 0.16));
        const barX = Math.round(dx);
        let isIcon = false;

        if (Math.abs(barX) <= barWidth / 2 && Math.abs(dy) <= height * 0.28) isIcon = true;
        if (Math.abs(Math.abs(barX) - spacing) <= barWidth / 2 && Math.abs(dy) <= height * 0.18) isIcon = true;
        if (Math.abs(Math.abs(barX) - spacing * 2) <= barWidth / 2 && Math.abs(dy) <= height * 0.10) isIcon = true;

        if (isIcon) {
          raw[pxOffset] = 204;    // R (#CC785C)
          raw[pxOffset + 1] = 120; // G
          raw[pxOffset + 2] = 92;  // B
          raw[pxOffset + 3] = 255; // A
        } else {
          // Edge antialiasing
          const alpha = dist > radius - 1 ? Math.round((radius - dist) * 255) : 255;
          raw[pxOffset] = r;
          raw[pxOffset + 1] = g;
          raw[pxOffset + 2] = b;
          raw[pxOffset + 3] = Math.max(0, Math.min(255, alpha));
        }
      } else {
        raw[pxOffset] = 0;
        raw[pxOffset + 1] = 0;
        raw[pxOffset + 2] = 0;
        raw[pxOffset + 3] = 0;
      }
    }
  }

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const compressed = zlib.deflateSync(raw);
  return Buffer.concat([
    sig,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0))
  ]);
}

const outDir = path.join(__dirname, '..', 'assets', 'icons');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

[16, 32, 48, 128].forEach((size) => {
  const png = generatePng(size);
  const outPath = path.join(outDir, `icon-${size}.png`);
  fs.writeFileSync(outPath, png);
  console.log(`Generated ${outPath} (${png.length} bytes)`);
});
