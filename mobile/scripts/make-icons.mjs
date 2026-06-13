// Generates the app's PNG icons with no external dependencies.
// Run: node scripts/make-icons.mjs
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(HERE, "..", "assets");

const BRAND = [0x5e, 0x6a, 0xd2];
const WHITE = [0xff, 0xff, 0xff];

// ---- tiny canvas ----
function canvas(w, h) {
  return { w, h, data: new Uint8Array(w * h * 4) };
}
function px(c, x, y, [r, g, b], a = 255) {
  if (x < 0 || y < 0 || x >= c.w || y >= c.h) return;
  const i = (y * c.w + x) * 4;
  c.data[i] = r;
  c.data[i + 1] = g;
  c.data[i + 2] = b;
  c.data[i + 3] = a;
}
function fill(c, color) {
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) px(c, x, y, color);
}
function roundRect(c, x0, y0, x1, y1, radius, color) {
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const cx = Math.min(Math.max(x, x0 + radius), x1 - radius);
      const cy = Math.min(Math.max(y, y0 + radius), y1 - radius);
      if ((x - cx) ** 2 + (y - cy) ** 2 <= radius * radius) px(c, x, y, color);
    }
  }
}
function circle(c, cx, cy, r, color) {
  for (let y = cy - r; y <= cy + r; y++)
    for (let x = cx - r; x <= cx + r; x++)
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px(c, x, y, color);
}

// Draw a centered lowercase "i" wordmark (dot + stem) scaled to the canvas.
function drawMark(c, color, scale = 1) {
  const s = c.w; // square
  const stemW = Math.round(s * 0.11 * scale);
  const cx = Math.round(s / 2);
  const stemTop = Math.round(s * (0.5 - 0.16 * scale));
  const stemBot = Math.round(s * (0.5 + 0.22 * scale));
  roundRect(c, cx - stemW / 2, stemTop, cx + stemW / 2, stemBot, stemW / 2, color);
  const dotR = Math.round(s * 0.075 * scale);
  const dotY = Math.round(s * (0.5 - 0.27 * scale));
  circle(c, cx, dotY, dotR, color);
}

// ---- PNG encoder ----
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePng(c) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(c.w, 0);
  ihdr.writeUInt32BE(c.h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  // rest 0
  const stride = 1 + c.w * 4;
  const raw = Buffer.alloc(c.h * stride);
  const src = Buffer.from(c.data.buffer, c.data.byteOffset, c.data.byteLength);
  for (let y = 0; y < c.h; y++) {
    raw[y * stride] = 0; // filter: none
    src.copy(raw, y * stride + 1, y * c.w * 4, (y + 1) * c.w * 4);
  }
  const idat = deflateSync(raw);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function save(name, c) {
  writeFileSync(join(ASSETS, name), encodePng(c));
  console.log("wrote", name, `${c.w}x${c.h}`);
}

mkdirSync(ASSETS, { recursive: true });

// App icon: brand square + white mark (launchers round the corners).
const icon = canvas(1024, 1024);
fill(icon, BRAND);
drawMark(icon, WHITE, 1);
save("icon.png", icon);

// Adaptive foreground: transparent + smaller centered mark (safe zone), brand bg via app.json.
const adaptive = canvas(1024, 1024);
drawMark(adaptive, WHITE, 0.62);
save("adaptive-icon.png", adaptive);

// Splash icon: transparent + white mark, used by expo-splash-screen.
const splash = canvas(512, 512);
drawMark(splash, WHITE, 0.7);
save("splash-icon.png", splash);

// Favicon for web preview.
const fav = canvas(64, 64);
fill(fav, BRAND);
drawMark(fav, WHITE, 1);
save("favicon.png", fav);
