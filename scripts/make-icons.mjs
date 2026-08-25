// Generates every app icon — web (PWA + tabs) and Android — from one brand mark,
// with no external dependencies.
// Run: node scripts/make-icons.mjs
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = join(ROOT, "public");
const APP_DIR = join(ROOT, "src", "app");
const MOBILE_ASSETS = join(ROOT, "mobile", "assets");

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

// ---- ICO encoder ----
// An .ico may carry PNG payloads directly, which every current browser reads —
// so the multi-size favicon reuses the PNG encoder above rather than packing
// bitmaps by hand.
function encodeIco(canvases) {
  const pngs = canvases.map(encodePng);
  const dir = Buffer.alloc(6);
  dir.writeUInt16LE(0, 0); // reserved
  dir.writeUInt16LE(1, 2); // type: icon
  dir.writeUInt16LE(pngs.length, 4);
  let offset = 6 + pngs.length * 16;
  const entries = canvases.map((c, i) => {
    const e = Buffer.alloc(16);
    e[0] = c.w >= 256 ? 0 : c.w; // 0 means 256
    e[1] = c.h >= 256 ? 0 : c.h;
    e[2] = 0; // palette entries
    e[3] = 0; // reserved
    e.writeUInt16LE(1, 4); // color planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(pngs[i].length, 8);
    e.writeUInt32LE(offset, 12);
    offset += pngs[i].length;
    return e;
  });
  return Buffer.concat([dir, ...entries, ...pngs]);
}

function save(dir, name, c) {
  writeFileSync(join(dir, name), encodePng(c));
  console.log("wrote", join(dir, name).slice(ROOT.length + 1), `${c.w}x${c.h}`);
}

// Box-average a canvas down by an integer factor — the poor man's antialiasing.
function downsample(c, factor) {
  const out = canvas(c.w / factor, c.h / factor);
  const n = factor * factor;
  for (let y = 0; y < out.h; y++) {
    for (let x = 0; x < out.w; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let dy = 0; dy < factor; dy++) {
        for (let dx = 0; dx < factor; dx++) {
          const i = ((y * factor + dy) * c.w + (x * factor + dx)) * 4;
          r += c.data[i]; g += c.data[i + 1]; b += c.data[i + 2]; a += c.data[i + 3];
        }
      }
      px(out, x, y, [Math.round(r / n), Math.round(g / n), Math.round(b / n)], Math.round(a / n));
    }
  }
  return out;
}

// A brand square with the white mark, at whatever size the target asks for.
// Rasterized at 4x and averaged down: the circle/roundRect fills have hard
// edges, and without this the dot on the "i" degenerates into a visible plus
// sign at favicon sizes.
function branded(size, scale = 1) {
  const SS = 4;
  const c = canvas(size * SS, size * SS);
  fill(c, BRAND);
  drawMark(c, WHITE, scale);
  return downsample(c, SS);
}

for (const dir of [PUBLIC, APP_DIR, MOBILE_ASSETS]) mkdirSync(dir, { recursive: true });

// ---- Web: PWA install icons (referenced by src/app/manifest.ts) ----
save(PUBLIC, "icon-192.png", branded(192));
save(PUBLIC, "icon-512.png", branded(512));

// Maskable: the mark sits inside the safe zone so platforms can crop the square
// to a circle/squircle without clipping it.
save(PUBLIC, "icon-maskable-512.png", branded(512, 0.62));

// ---- Web: browser tab + Safari "Add to Dock" (Next.js file conventions) ----
save(APP_DIR, "icon.png", branded(256));
save(APP_DIR, "apple-icon.png", branded(180));

// The tab icon. Small sizes get a slightly larger mark so the stem and dot stay
// legible once the browser scales it down.
const favicon = encodeIco([branded(16, 1.25), branded(32, 1.1), branded(48)]);
writeFileSync(join(APP_DIR, "favicon.ico"), favicon);
console.log("wrote", "src/app/favicon.ico", "16/32/48");

// ---- Android (Expo shell) ----
// App icon: brand square + white mark (launchers round the corners).
save(MOBILE_ASSETS, "icon.png", branded(1024));

// Adaptive foreground: transparent + smaller centered mark (safe zone), brand bg via app.json.
const adaptive = canvas(1024, 1024);
drawMark(adaptive, WHITE, 0.62);
save(MOBILE_ASSETS, "adaptive-icon.png", adaptive);

// Splash icon: transparent + white mark, used by expo-splash-screen.
const splash = canvas(512, 512);
drawMark(splash, WHITE, 0.7);
save(MOBILE_ASSETS, "splash-icon.png", splash);

// Favicon for the Expo web preview.
save(MOBILE_ASSETS, "favicon.png", branded(64));
