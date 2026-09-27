import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Minimal valid PNG generator in pure node using zlib
function createSolidPng(width, height, r, g, b, a = 255) {
  // Construct raw uncompressed scanlines
  // Each scanline: filter byte 0 + RGBA per pixel
  const bytesPerPixel = 4;
  const rowBytes = 1 + width * bytesPerPixel;
  const rawData = Buffer.alloc(height * rowBytes);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowBytes;
    rawData[rowOffset] = 0; // Filter: None
    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * bytesPerPixel;
      // Draw a subtle football pattern or rounded shield
      const dx = x - width / 2;
      const dy = y - height / 2;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const radius = width * 0.42;

      if (dist < radius) {
        // Center ball/badge color
        const innerDist = Math.sqrt(dx * dx + dy * dy);
        if (innerDist < radius * 0.85) {
          // Ball center (emerald green & white lines)
          rawData[pxOffset] = 16;     // R (Emerald)
          rawData[pxOffset + 1] = 185; // G
          rawData[pxOffset + 2] = 129; // B
          rawData[pxOffset + 3] = 255;
        } else {
          // Border
          rawData[pxOffset] = 255;
          rawData[pxOffset + 1] = 255;
          rawData[pxOffset + 2] = 255;
          rawData[pxOffset + 3] = 255;
        }
      } else {
        // Background dark navy
        rawData[pxOffset] = r;
        rawData[pxOffset + 1] = g;
        rawData[pxOffset + 2] = b;
        rawData[pxOffset + 3] = a;
      }
    }
  }

  const deflated = zlib.deflateSync(rawData);

  // PNG Header
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crc = crc32(Buffer.concat([typeBuf, data]));
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; // Compression
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // Interlace

  const ihdrChunk = chunk('IHDR', ihdr);
  const idatChunk = chunk('IDAT', deflated);
  const iendChunk = chunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Standard CRC32 calculation
function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Generate PNGs
const pwa192 = createSolidPng(192, 192, 15, 23, 42, 255);
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), pwa192);

const pwa512 = createSolidPng(512, 512, 15, 23, 42, 255);
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), pwa512);
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), pwa512);

const appleTouch = createSolidPng(180, 180, 15, 23, 42, 255);
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), appleTouch);

const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
  <rect width="512" height="512" rx="128" fill="#0F172A"/>
  <circle cx="256" cy="256" r="190" fill="#10B981" fill-opacity="0.15" stroke="#10B981" stroke-width="8"/>
  <circle cx="256" cy="256" r="140" fill="#1E293B" stroke="#38BDF8" stroke-width="6"/>
  <!-- Football icon -->
  <polygon points="256,170 290,195 277,235 235,235 222,195" fill="#38BDF8" />
  <polygon points="256,342 222,317 235,277 277,277 290,317" fill="#10B981" />
  <circle cx="256" cy="256" r="12" fill="#FFFFFF"/>
  <path d="M256 120 L256 170 M256 342 L256 392" stroke="#94A3B8" stroke-width="4" stroke-linecap="round"/>
  <!-- Checkmark badge -->
  <circle cx="370" cy="370" r="60" fill="#10B981" stroke="#0F172A" stroke-width="8"/>
  <path d="M346 370 L364 388 L396 354" stroke="#FFFFFF" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
fs.writeFileSync(path.join(publicDir, 'icon.svg'), svgIcon);
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), appleTouch);

console.log('Icons generated successfully in public/');
