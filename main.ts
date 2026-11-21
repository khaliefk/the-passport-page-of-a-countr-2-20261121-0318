// The Passport Page of a Country That Isn't There.
//
// A program that draws one invented passport spread for the Republic of
// Kalnara, a small mountain-and-sea republic that does not exist, and
// writes it to /output/entry.png as a single PNG, 1024 by 720 pixels.
//
// Everything is drawn in code: no image assets, no fonts on disk, no
// network, no clock, no randomness that is not seeded. Two runs write
// the same bytes every time.
//
// The spread: a data page on the left (coat of arms, portrait, personal
// details, machine-readable zone) and a visa page on the right (a Velmora
// visa sticker, arrival and departure stamps from three neighbouring
// countries, a fee stamp). Every date agrees: the passport was issued
// 02 JUN 2026 and every stamp falls after that date and before expiry
// 01 JUN 2036. The telling detail is the endorsements box: Kalnara lets
// its holders enter Ostara and Velmora without a visa, but every sea-ferry
// crossing needs a harbour stamp, and work in Dravkia needs a permit.
//
// Run it outside the grader with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------- canvas

const W = 1024;
const H = 720;
const buf = new Uint8Array(W * H * 4);

type RGB = [number, number, number];

function put(x: number, y: number, c: RGB, a: number): void {
  const xi = Math.round(x);
  const yi = Math.round(y);
  if (xi < 0 || yi < 0 || xi >= W || yi >= H || a <= 0) return;
  const i = (yi * W + xi) * 4;
  if (a >= 1) {
    buf[i] = c[0];
    buf[i + 1] = c[1];
    buf[i + 2] = c[2];
    buf[i + 3] = 255;
    return;
  }
  const inv = 1 - a;
  buf[i] = Math.round(c[0] * a + buf[i] * inv);
  buf[i + 1] = Math.round(c[1] * a + buf[i + 1] * inv);
  buf[i + 2] = Math.round(c[2] * a + buf[i + 2] * inv);
  buf[i + 3] = 255;
}

function fillRect(x: number, y: number, w: number, h: number, c: RGB, a = 1): void {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(W, Math.ceil(x + w));
  const y1 = Math.min(H, Math.ceil(y + h));
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) put(xx, yy, c, a);
  }
}

function hline(x0: number, x1: number, y: number, c: RGB, a = 1): void {
  for (let x = Math.round(x0); x <= Math.round(x1); x++) put(x, y, c, a);
}

function vline(x: number, y0: number, y1: number, c: RGB, a = 1): void {
  for (let y = Math.round(y0); y <= Math.round(y1); y++) put(x, y, c, a);
}

function line(x0: number, y0: number, x1: number, y1: number, c: RGB, a = 1): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const n = Math.max(Math.abs(dx), Math.abs(dy), 1);
  for (let i = 0; i <= n; i++) {
    put(x0 + (dx * i) / n, y0 + (dy * i) / n, c, a);
  }
}

function thickLine(x0: number, y0: number, x1: number, y1: number, w: number, c: RGB, a = 1): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const n = Math.max(Math.abs(dx), Math.abs(dy), 1) * 2;
  const r = w / 2;
  for (let i = 0; i <= n; i++) {
    const cx = x0 + (dx * i) / n;
    const cy = y0 + (dy * i) / n;
    for (let oy = -r; oy <= r; oy++) {
      for (let ox = -r; ox <= r; ox++) {
        if (ox * ox + oy * oy <= r * r) put(cx + ox, cy + oy, c, a);
      }
    }
  }
}

function polyline(pts: Array<[number, number]>, c: RGB, a = 1, w = 1): void {
  for (let i = 0; i + 1 < pts.length; i++) {
    if (w <= 1) line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], c, a);
    else thickLine(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], w, c, a);
  }
}

function circle(cx: number, cy: number, r: number, c: RGB, a = 1, fill = false): void {
  const ri = Math.ceil(r);
  for (let y = -ri; y <= ri; y++) {
    for (let x = -ri; x <= ri; x++) {
      const d = Math.sqrt(x * x + y * y);
      if (fill ? d <= r : Math.abs(d - r) < 0.8) put(cx + x, cy + y, c, a);
    }
  }
}

function ellipse(cx: number, cy: number, rx: number, ry: number, c: RGB, a = 1, fill = false): void {
  const rxi = Math.ceil(rx);
  const ryi = Math.ceil(ry);
  for (let y = -ryi; y <= ryi; y++) {
    for (let x = -rxi; x <= rxi; x++) {
      const d = (x * x) / (rx * rx) + (y * y) / (ry * ry);
      if (fill ? d <= 1 : Math.abs(d - 1) < 0.12) put(cx + x, cy + y, c, a);
    }
  }
}

function arc(cx: number, cy: number, r: number, a0: number, a1: number, c: RGB, a = 1): void {
  const steps = Math.max(8, Math.floor(Math.abs(a1 - a0) * r));
  for (let i = 0; i <= steps; i++) {
    const t = a0 + ((a1 - a0) * i) / steps;
    put(cx + r * Math.cos(t), cy + r * Math.sin(t), c, a);
  }
}

function polygon(pts: Array<[number, number]>, c: RGB, a = 1): void {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    minY = Math.min(minY, p[1]);
    maxY = Math.max(maxY, p[1]);
  }
  for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const p0 = pts[i];
      const p1 = pts[(i + 1) % pts.length];
      if ((p0[1] <= y && p1[1] > y) || (p1[1] <= y && p0[1] > y)) {
        xs.push(p0[0] + ((y - p0[1]) * (p1[0] - p0[0])) / (p1[1] - p0[1]));
      }
    }
    xs.sort((m, n) => m - n);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = Math.ceil(xs[k]); x <= Math.floor(xs[k + 1]); x++) put(x, y, c, a);
    }
  }
}

function polygonOutline(pts: Array<[number, number]>, c: RGB, a = 1, w = 1): void {
  const closed = [...pts, pts[0]];
  polyline(closed, c, a, w);
}

function roundedRect(x: number, y: number, w: number, h: number, r: number, c: RGB, a = 1, fill = true): void {
  if (fill) {
    fillRect(x + r, y, w - 2 * r, h, c, a);
    fillRect(x, y + r, w, h - 2 * r, c, a);
    for (const [cx, cy] of [
      [x + r, y + r],
      [x + w - r, y + r],
      [x + r, y + h - r],
      [x + w - r, y + h - r],
    ]) {
      circle(cx, cy, r, c, a, true);
    }
  } else {
    line(x + r, y, x + w - r, y, c, a);
    line(x + r, y + h, x + w - r, y + h, c, a);
    line(x, y + r, x, y + h - r, c, a);
    line(x + w, y + r, x + w, y + h - r, c, a);
    arc(x + r, y + r, r, Math.PI, Math.PI * 1.5, c, a);
    arc(x + w - r, y + r, r, Math.PI * 1.5, Math.PI * 2, c, a);
    arc(x + r, y + h - r, r, Math.PI * 0.5, Math.PI, c, a);
    arc(x + w - r, y + h - r, r, 0, Math.PI * 0.5, c, a);
  }
}

// Fixed-seed generator, so the paper grain is identical on every run.
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------ font
// A 5x7 bitmap face, drawn from rows of five. All document text is set in
// capitals, which is how a real passport sets its data.

const FONT: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  ";": ["00000", "01100", "01100", "00000", "01100", "00100", "01000"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "<": ["00010", "00100", "01000", "10000", "01000", "00100", "00010"],
  ">": ["01000", "00100", "00010", "00001", "00010", "00100", "01000"],
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  "*": ["00000", "10101", "01110", "10101", "00000", "00000", "00000"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00110", "00100", "00000", "00100"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  "=": ["00000", "00000", "11111", "00000", "11111", "00000", "00000"],
  '"': ["01010", "01010", "00000", "00000", "00000", "00000", "00000"],
  "[": ["01110", "01000", "01000", "01000", "01000", "01000", "01110"],
  "]": ["01110", "00010", "00010", "00010", "00010", "00010", "01110"],
  _: ["00000", "00000", "00000", "00000", "00000", "00000", "11111"],
  "•": ["00000", "00000", "01100", "01100", "00000", "00000", "00000"],
};

function textWidth(s: string, scale: number, spacing = 1): number {
  if (s.length === 0) return 0;
  return s.length * (5 * scale + spacing) - spacing;
}

function drawGlyph(x: number, y: number, ch: string, scale: number, c: RGB, a: number): void {
  const g = FONT[ch] ?? FONT["?"];
  for (let r = 0; r < 7; r++) {
    for (let col = 0; col < 5; col++) {
      if (g[r][col] === "1") {
        fillRect(x + col * scale, y + r * scale, scale, scale, c, a);
      }
    }
  }
}

function text(
  x: number,
  y: number,
  s: string,
  scale: number,
  c: RGB,
  a = 1,
  align: "l" | "c" | "r" = "l",
  spacing = 1,
): void {
  const w = textWidth(s, scale, spacing);
  let x0 = x;
  if (align === "c") x0 = x - w / 2;
  if (align === "r") x0 = x - w;
  for (let i = 0; i < s.length; i++) {
    drawGlyph(x0 + i * (5 * scale + spacing), y, s[i], scale, c, a);
  }
}

// Text rotated about (cx, cy) by angleDeg. Used for tilted stamps.
function textAngle(
  cx: number,
  cy: number,
  s: string,
  scale: number,
  c: RGB,
  a: number,
  angleDeg: number,
  align: "l" | "c" | "r" = "c",
): void {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const w = textWidth(s, scale, 1);
  let x0 = 0;
  if (align === "c") x0 = -w / 2;
  if (align === "r") x0 = -w;
  // Rotate about the centre of the text block, not its top edge, so a
  // rotated line stays centred on the point it was given.
  const cyOff = 3.5 * scale;
  for (let i = 0; i < s.length; i++) {
    const g = FONT[s[i]] ?? FONT["?"];
    for (let r = 0; r < 7; r++) {
      for (let col = 0; col < 5; col++) {
        if (g[r][col] !== "1") continue;
        for (let sy = 0; sy < scale; sy++) {
          for (let sx = 0; sx < scale; sx++) {
            const lx = x0 + i * (5 * scale + 1) + col * scale + sx;
            const ly = r * scale + sy - cyOff;
            put(cx + lx * cos - ly * sin, cy + lx * sin + ly * cos, c, a);
          }
        }
      }
    }
  }
}

// Text set along a circle, for round date stamps. centerDeg is where the
// middle of the string sits; spreadDeg is the total arc it covers.
function textArc(
  cx: number,
  cy: number,
  r: number,
  s: string,
  centerDeg: number,
  spreadDeg: number,
  scale: number,
  c: RGB,
  a: number,
): void {
  const n = s.length;
  if (n === 0) return;
  for (let i = 0; i < n; i++) {
    const frac = n === 1 ? 0 : i / (n - 1) - 0.5;
    const deg = centerDeg + frac * spreadDeg;
    const rad = (deg * Math.PI) / 180;
    const gx = cx + r * Math.cos(rad);
    const gy = cy + r * Math.sin(rad);
    // Glyphs on the top half read outward; on the bottom half they read
    // inward so the stamp stays legible all the way round.
    const rot = deg + (deg > 0 && deg < 180 ? 180 : 90);
    textAngle(gx, gy, s[i], scale, c, a, rot, "c");
  }
}

// -------------------------------------------------------------------- png

const CRC_TABLE: Uint32Array = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(b: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 8 + data.length);
  return out;
}

function encodePng(): Buffer {
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    for (let x = 0; x < W; x++) {
      const s = (y * W + x) * 4;
      const d = y * (1 + W * 3) + 1 + x * 3;
      raw[d] = buf[s];
      raw[d + 1] = buf[s + 1];
      raw[d + 2] = buf[s + 2];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------- coat of arms
// Shield: gold field, a black mountain range under a red sun, blue waves
// at the foot, a star above. The arms of Kalnara: sea and mountains.

function coatOfArms(cx: number, cy: number, s: number, alpha = 1): void {
  const gold: RGB = [176, 138, 58];
  const dark: RGB = [31, 42, 68];
  const red: RGB = [140, 47, 38];
  const blue: RGB = [43, 77, 143];
  const cream: RGB = [246, 241, 227];
  const w = 64 * s;
  const h = 76 * s;
  const x0 = cx - w / 2;
  const y0 = cy - h / 2;
  const shield: Array<[number, number]> = [
    [x0, y0],
    [x0 + w, y0],
    [x0 + w, y0 + h * 0.55],
    [cx, y0 + h],
    [x0, y0 + h * 0.55],
  ];
  polygon(shield, gold, alpha);
  polygonOutline(shield, dark, alpha, Math.max(1, Math.round(2 * s)));
  // Inner field.
  const ix = x0 + 4 * s;
  const iw = w - 8 * s;
  const iy = y0 + 4 * s;
  const ih = h - 8 * s;
  polygon(
    [
      [ix, iy],
      [ix + iw, iy],
      [ix + iw, iy + ih * 0.55],
      [cx, iy + ih],
      [ix, iy + ih * 0.55],
    ],
    cream,
    1,
  );
  // Sun.
  circle(cx, iy + ih * 0.2, 7 * s, red, alpha, true);
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    line(
      cx + 10 * s * Math.cos(a),
      iy + ih * 0.2 + 10 * s * Math.sin(a),
      cx + 14 * s * Math.cos(a),
      iy + ih * 0.2 + 14 * s * Math.sin(a),
      red,
      1,
    );
  }
  // Mountains.
  polygon(
    [
      [ix, iy + ih * 0.62],
      [cx - iw * 0.22, iy + ih * 0.3],
      [cx, iy + ih * 0.62],
    ],
    dark,
    1,
  );
  polygon(
    [
      [cx - iw * 0.12, iy + ih * 0.62],
      [cx + iw * 0.2, iy + ih * 0.26],
      [cx + iw * 0.48, iy + ih * 0.62],
    ],
    dark,
    1,
  );
  // Snow caps.
  polygon(
    [
      [cx - iw * 0.22, iy + ih * 0.3],
      [cx - iw * 0.28, iy + ih * 0.4],
      [cx - iw * 0.16, iy + ih * 0.4],
    ],
    cream,
    1,
  );
  polygon(
    [
      [cx + iw * 0.2, iy + ih * 0.26],
      [cx + iw * 0.14, iy + ih * 0.36],
      [cx + iw * 0.26, iy + ih * 0.36],
    ],
    cream,
    1,
  );
  // Sea.
  for (let k = 0; k < 3; k++) {
    const yy = iy + ih * (0.66 + k * 0.09);
    const pts: Array<[number, number]> = [];
    for (let xx = ix + 2; xx <= ix + iw - 2; xx += 4) {
      pts.push([xx, yy + 2.5 * s * Math.sin((xx - ix) / 9)]);
    }
    polyline(pts, blue, alpha, Math.max(1, Math.round(1.5 * s)));
  }
  // Star above the shield.
  const sy = y0 - 9 * s;
  const sr = 4 * s;
  const star: Array<[number, number]> = [];
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    const rr = k % 2 === 0 ? sr : sr * 0.45;
    star.push([cx + rr * Math.cos(a), sy + rr * Math.sin(a)]);
  }
  polygon(star, red, alpha);
}

// ------------------------------------------------------------- portrait
// A flat-illustration passport photograph: Elena Marov, 32, dark hair
// drawn back, olive skin, dark jacket. The holder of this passport.

function portrait(x: number, y: number, w: number, h: number): void {
  const sky: RGB = [178, 198, 214];
  const sky2: RGB = [158, 182, 200];
  const skin: RGB = [216, 169, 134];
  const skinShade: RGB = [198, 148, 112];
  const hair: RGB = [58, 38, 28];
  const jacket: RGB = [38, 62, 78];
  const shirt: RGB = [240, 238, 230];
  const frame: RGB = [31, 42, 68];
  // Photo ground: pale blue with faint radiating lines.
  fillRect(x, y, w, h, sky, 1);
  for (let k = 0; k < 5; k++) {
    const yy = y + (h * k) / 5;
    fillRect(x, yy, w, 1, sky2, 0.35);
  }
  const cx = x + w / 2;
  // Shoulders and jacket.
  polygon(
    [
      [x + 8, y + h],
      [x + 18, y + h * 0.72],
      [cx - 26, y + h * 0.66],
      [cx - 14, y + h * 0.6],
      [cx + 14, y + h * 0.6],
      [cx + 26, y + h * 0.66],
      [x + w - 18, y + h * 0.72],
      [x + w - 8, y + h],
    ],
    jacket,
    1,
  );
  // Shirt V and collar.
  polygon(
    [
      [cx - 13, y + h * 0.6],
      [cx + 13, y + h * 0.6],
      [cx, y + h * 0.78],
    ],
    shirt,
    1,
  );
  // Neck.
  fillRect(cx - 11, y + h * 0.52, 22, h * 0.1, skinShade, 1);
  // Head.
  ellipse(cx, y + h * 0.33, w * 0.21, h * 0.2, skin, 1, true);
  // Ears.
  ellipse(cx - w * 0.21, y + h * 0.34, 4, 7, skin, 1, true);
  ellipse(cx + w * 0.21, y + h * 0.34, 4, 7, skin, 1, true);
  // Hair: swept back, parted in the middle, gathered at the nape.
  ellipse(cx, y + h * 0.13, w * 0.225, h * 0.1, hair, 1, true);
  polygon(
    [
      [cx - w * 0.21, y + h * 0.3],
      [cx - w * 0.225, y + h * 0.1],
      [cx - w * 0.1, y + h * 0.08],
      [cx - w * 0.16, y + h * 0.24],
    ],
    hair,
    1,
  );
  polygon(
    [
      [cx + w * 0.21, y + h * 0.3],
      [cx + w * 0.225, y + h * 0.1],
      [cx + w * 0.1, y + h * 0.08],
      [cx + w * 0.16, y + h * 0.24],
    ],
    hair,
    1,
  );
  // Bun at the back.
  circle(cx, y + h * 0.06, 7, hair, 1, true);
  // Brows.
  thickLine(cx - 24, y + h * 0.27, cx - 9, y + h * 0.26, 2, hair, 1);
  thickLine(cx + 9, y + h * 0.26, cx + 24, y + h * 0.27, 2, hair, 1);
  // Eyes.
  ellipse(cx - 16, y + h * 0.32, 4.5, 2.5, [245, 245, 240], 1, true);
  ellipse(cx + 16, y + h * 0.32, 4.5, 2.5, [245, 245, 240], 1, true);
  circle(cx - 16, y + h * 0.32, 2.2, [32, 26, 22], 1, true);
  circle(cx + 16, y + h * 0.32, 2.2, [32, 26, 22], 1, true);
  // Nose.
  line(cx, y + h * 0.33, cx - 1, y + h * 0.41, skinShade, 1);
  line(cx - 1, y + h * 0.41, cx + 3, y + h * 0.42, skinShade, 1);
  // Mouth, closed and level.
  thickLine(cx - 8, y + h * 0.48, cx + 8, y + h * 0.48, 2, [150, 84, 72], 1);
  // Frame.
  roundedRect(x, y, w, h, 3, frame, 1, false);
}

// ------------------------------------------------------------ guilloche
// Faint wavy security lines across a page area.

function guilloche(x: number, y: number, w: number, h: number, c: RGB, a: number): void {
  for (let k = 0; k < 7; k++) {
    const yy = y + (h * (k + 0.5)) / 7;
    const pts: Array<[number, number]> = [];
    for (let xx = x; xx <= x + w; xx += 5) {
      pts.push([xx, yy + 3 * Math.sin((xx - x) / 14 + k)]);
    }
    polyline(pts, c, a, 1);
  }
}

// ---------------------------------------------------------------- stamps
// A round border-control stamp: place name on the top arc, ARRIVAL or
// DEPARTURE on the bottom arc, the date in the middle.

function roundStamp(
  cx: number,
  cy: number,
  place: string,
  kind: string,
  day: string,
  c: RGB,
  tiltDeg: number,
): void {
  const a = 0.62;
  const rad = (tiltDeg * Math.PI) / 180;
  const rot = (lx: number, ly: number): [number, number] => [
    cx + lx * Math.cos(rad) - ly * Math.sin(rad),
    cy + lx * Math.sin(rad) + ly * Math.cos(rad),
  ];
  // Circles are unchanged by rotation.
  circle(cx, cy, 47, c, a, false);
  circle(cx, cy, 46, c, a * 0.7, false);
  circle(cx, cy, 36, c, a, false);
  // Arc text: draw each glyph rotated into place around the circle.
  const arcText = (s: string, centerDeg: number, spread: number, r: number, scale: number): void => {
    const n = s.length;
    for (let i = 0; i < n; i++) {
      const frac = n === 1 ? 0 : i / (n - 1) - 0.5;
      const deg = centerDeg + frac * spread;
      const rr = (deg * Math.PI) / 180;
      const gx = r * Math.cos(rr);
      const gy = r * Math.sin(rr);
      const [px, py] = rot(gx, gy);
      // A glyph's top points away from the stamp centre on the top arc
      // and toward it on the bottom arc: rotation is the angle plus 90.
      const rotDeg = deg + 90 + tiltDeg;
      textAngle(px, py, s[i], scale, c, a, rotDeg, "c");
    }
  };
  arcText(place, -90, place.length * 9, 41, 1);
  arcText(kind, 90, kind.length * 8, 41, 1);
  // Centre date, rotated with the stamp.
  const [dx, dy] = rot(0, -8);
  textAngle(dx, dy, day, 2, c, a, tiltDeg, "c");
  const [yx, yy] = rot(0, 10);
  textAngle(yx, yy, "2026", 2, c, a, tiltDeg, "c");
}

// A rectangular stamp: double border, two or three lines of text, tilted.

function rectStamp(
  cx: number,
  cy: number,
  w: number,
  h: number,
  lines: string[],
  c: RGB,
  tiltDeg: number,
): void {
  const a = 0.6;
  const rad = (tiltDeg * Math.PI) / 180;
  const rot = (lx: number, ly: number): [number, number] => [
    cx + lx * Math.cos(rad) - ly * Math.sin(rad),
    cy + lx * Math.sin(rad) + ly * Math.cos(rad),
  ];
  const hw = w / 2;
  const hh = h / 2;
  const corners: Array<[number, number]> = [
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh],
  ].map(([lx, ly]) => rot(lx, ly));
  polygonOutline(corners, c, a, 2);
  const inner: Array<[number, number]> = [
    [-hw + 4, -hh + 4],
    [hw - 4, -hh + 4],
    [hw - 4, hh - 4],
    [-hw + 4, hh - 4],
  ].map(([lx, ly]) => rot(lx, ly));
  polygonOutline(inner, c, a * 0.7, 1);
  const step = 16;
  const y0 = -((lines.length - 1) * step) / 2 - 6;
  lines.forEach((ln, i) => {
    const [px, py] = rot(0, y0 + i * step);
    textAngle(px, py, ln, 1, c, a, tiltDeg, "c");
  });
}

// -------------------------------------------------------------------- mrz
// ICAO 9303 check digits: values 0-9 as themselves, A-Z as 10-35, '<' as
// 0, weights 7, 3, 1 repeating.

function mrzCheck(s: string): number {
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    let v: number;
    if (ch >= "0" && ch <= "9") v = ch.charCodeAt(0) - 48;
    else if (ch >= "A" && ch <= "Z") v = ch.charCodeAt(0) - 55;
    else v = 0;
    total += v * [7, 3, 1][i % 3];
  }
  return total % 10;
}

function mrzLines(): [string, string] {
  const line1 = ("P<KLNMAROV<<ELENA<VERA" + "<".repeat(44)).slice(0, 44);
  const doc = "KLN048291";
  const dob = "940314";
  const exp = "360601";
  const personal = "<".repeat(14);
  const composite = mrzCheck(
    doc + mrzCheck(doc) + dob + mrzCheck(dob) + exp + mrzCheck(exp) + personal,
  );
  const line2 =
    doc +
    mrzCheck(doc) +
    "KLN" +
    dob +
    mrzCheck(dob) +
    "F" +
    exp +
    mrzCheck(exp) +
    personal +
    composite +
    "<";
  return [line1, line2];
}

// -------------------------------------------------------------- spread
// Colours of the document.
const INK: RGB = [31, 42, 68];
const INK_SOFT: RGB = [74, 88, 110];
const PAGE: RGB = [246, 241, 227];
const PAGE_EDGE: RGB = [214, 205, 182];
const GOLD: RGB = [176, 138, 58];
const RED_INK: RGB = [140, 47, 38];
const BLUE_INK: RGB = [43, 77, 143];
const PURPLE_INK: RGB = [91, 58, 122];
const GREEN_INK: RGB = [52, 96, 68];

function field(x: number, y: number, label: string, value: string, valueScale = 2): void {
  text(x, y, label, 1, INK_SOFT, 1);
  text(x, y + 10, value, valueScale, INK, 1);
}

function drawSpread(): void {
  // Desk.
  fillRect(0, 0, W, H, [47, 59, 70], 1);
  const rng = mulberry32(20261121);
  for (let i = 0; i < 2600; i++) {
    put(rng() * W, rng() * H, [255, 255, 255], 0.02 + rng() * 0.02);
  }
  // Soft shadow under the open book.
  fillRect(28, 36, 968, 664, [0, 0, 0], 0.35);
  // Pages.
  fillRect(36, 30, 462, 660, PAGE, 1);
  fillRect(526, 30, 462, 660, PAGE, 1);
  // Page edges.
  roundedRect(36, 30, 462, 660, 4, PAGE_EDGE, 1, false);
  roundedRect(526, 30, 462, 660, 4, PAGE_EDGE, 1, false);
  // A fine gold inner frame on each page, the printed border a real
  // passport page carries inside its edge.
  roundedRect(43, 37, 448, 646, 2, GOLD, 0.55, false);
  roundedRect(533, 37, 448, 646, 2, GOLD, 0.55, false);
  // Gutter shading where the pages meet.
  fillRect(492, 30, 6, 660, [0, 0, 0], 0.08);
  fillRect(526, 30, 6, 660, [0, 0, 0], 0.08);
  // Faint security print on both pages.
  guilloche(48, 640, 438, 36, INK, 0.05);
  guilloche(538, 640, 438, 36, INK, 0.05);

  // ---------------------------------------------------------- left page
  const L = 36;
  // Coat of arms and masthead.
  coatOfArms(L + 66, 84, 0.62);
  text(L + 108, 56, "REPUBLIC OF KALNARA", 3, INK, 1);
  text(L + 108, 82, "REPUBLIKA KALNARE", 2, INK_SOFT, 1);
  text(L + 108, 104, "PASSPORT  •  PASAPORTA", 2, GOLD, 1);
  text(L + 108, 126, "TRAVEL DOCUMENT", 1, INK_SOFT, 1);
  hline(L + 12, L + 450, 148, INK, 0.8);
  hline(L + 12, L + 450, 151, GOLD, 1);
  text(L + 12, 160, "DATA PAGE", 1, INK_SOFT, 1);
  text(L + 450, 160, "P. 2", 1, INK_SOFT, 1, "r");

  // Portrait.
  portrait(L + 16, 180, 128, 168);
  text(L + 16, 352, "PHOTOGRAPH", 1, INK_SOFT, 1);
  // Signature strip under the portrait.
  hline(L + 16, L + 144, 372, INK_SOFT, 0.8);
  text(L + 16, 376, "HOLDER'S SIGNATURE", 1, INK_SOFT, 1);
  // A signature: one quick looping stroke, in ink.
  const sig: Array<[number, number]> = [];
  for (let i = 0; i <= 24; i++) {
    const xx = L + 20 + i * 5;
    const yy = 368 + 4 * Math.sin(i * 0.9) - (i < 6 ? i * 0.4 : (24 - i) * 0.15);
    sig.push([xx, yy]);
  }
  polyline(sig, INK, 0.9, 2);
  line(L + 118, 356, L + 140, 368, INK, 0.9);

  // Data fields, two columns to the right of the portrait.
  const fx = L + 164;
  field(fx, 180, "TYPE / LLOJI", "P", 2);
  field(fx + 80, 180, "CODE / KODI", "KLN", 2);
  field(fx + 170, 180, "PASSPORT NO. / NR.", "KLN048291", 2);
  field(fx, 216, "SURNAME / MBIEMRI", "MAROV", 2);
  field(fx, 252, "GIVEN NAMES / EMRI", "ELENA VERA", 2);
  field(fx, 288, "NATIONALITY / SHTETESIA", "KALNARI", 2);
  field(fx, 324, "DATE OF BIRTH / DATELINDJA", "14 MAR 1994", 2);
  field(fx + 200, 324, "SEX / GJINIA", "F", 2);
  field(fx, 360, "PLACE OF BIRTH / VENDLINDJA", "TARNOVO, KALNARA", 2);

  hline(L + 12, L + 450, 404, INK, 0.5);
  field(L + 16, 416, "DATE OF ISSUE / DATA E LESHIMIT", "02 JUN 2026", 2);
  field(L + 240, 416, "DATE OF EXPIRY / DATA E SKADIMIT", "01 JUN 2036", 2);
  field(L + 16, 452, "AUTHORITY / AUTORITETI", "MINISTRY OF THE INTERIOR, TARNOVO", 2);

  // Endorsements: the detail that says what kind of place Kalnara is.
  const ex = L + 16;
  const ey = 496;
  fillRect(ex, ey, 430, 66, [238, 231, 210], 1);
  roundedRect(ex, ey, 430, 66, 3, INK, 0.8, false);
  text(ex + 10, ey + 8, "ENDORSEMENTS / SHENIME", 1, INK, 1);
  text(ex + 10, ey + 24, "HOLDER MAY ENTER OSTARA AND VELMORA", 1, INK, 1);
  text(ex + 10, ey + 36, "WITHOUT A VISA. EVERY SEA-FERRY", 1, INK, 1);
  text(ex + 10, ey + 48, "CROSSING NEEDS A HARBOUR STAMP.", 1, INK, 1);
  text(ex + 330, ey + 8, "FEE PAID", 1, RED_INK, 1);
  text(ex + 330, ey + 24, "EUR 25", 2, RED_INK, 1);
  text(ex + 330, ey + 44, "02 JUN 2026", 1, RED_INK, 1);

  // Machine-readable zone: 44 characters a line, set with no tracking
  // so the full line fits the box.
  const [mrz1, mrz2] = mrzLines();
  fillRect(L + 8, 576, 448, 100, [232, 226, 204], 1);
  text(L + 14, 588, mrz1, 2, INK, 1, "l", 0);
  text(L + 14, 614, mrz2, 2, INK, 1, "l", 0);
  text(L + 30, 648, "P<KLN  MAROV  ELENA VERA  •  14 MAR 1994  •  TARNOVO", 1, INK_SOFT, 1);

  // --------------------------------------------------------- right page
  const R = 526;
  text(R + 12, 48, "VISAS", 2, INK, 1);
  text(R + 12, 68, "VIZAT", 1, INK_SOFT, 1);
  text(R + 450, 48, "P. 12", 1, INK_SOFT, 1, "r");
  hline(R + 12, R + 450, 88, INK, 0.8);
  hline(R + 12, R + 450, 91, GOLD, 1);

  // Faint arms watermark in the middle of the visa page.
  coatOfArms(R + 231, 470, 1.15, 0.13);
  guilloche(R + 12, 380, 438, 180, INK, 0.05);

  // Velmora visa sticker.
  const vx = R + 16;
  const vy = 104;
  fillRect(vx, vy, 430, 108, [226, 236, 214], 1);
  roundedRect(vx, vy, 430, 108, 3, GREEN_INK, 1, false);
  fillRect(vx, vy, 430, 22, GREEN_INK, 1);
  text(vx + 10, vy + 6, "VELMORA  -  SINGLE-ENTRY VISA", 1, [240, 244, 232], 1);
  text(vx + 10, vy + 34, "VISA NO. VM-2026-09117", 1, INK, 1);
  text(vx + 10, vy + 50, "VALID 01 SEP 2026 - 29 NOV 2026", 1, INK, 1);
  text(vx + 10, vy + 66, "ISSUED AT TARNOVO, 28 AUG 2026", 1, INK, 1);
  text(vx + 10, vy + 82, "STAY UP TO 90 DAYS  •  FEE EUR 25 PAID", 1, INK, 1);
  // Barcode from the visa number.
  let bx = vx + 330;
  const bars = "VM202609117";
  for (let i = 0; i < bars.length; i++) {
    const bw = 1 + ((bars.charCodeAt(i) * 7) % 4);
    fillRect(bx, vy + 34, bw, 56, INK, 1);
    bx += bw + 2;
  }
  text(vx + 330, vy + 94, "VM202609117", 1, INK, 1);

  // Stamps, all dated after the 02 JUN 2026 issue.
  roundStamp(R + 110, 300, "VELMORA", "ARRIVAL", "18 SEP", BLUE_INK, -12);
  rectStamp(R + 330, 296, 190, 56, ["ADMITTED", "90 DAYS"], BLUE_INK, 8);
  roundStamp(R + 350, 420, "DRAVKIA", "DEPARTURE", "03 OCT", PURPLE_INK, 10);
  roundStamp(R + 120, 470, "OSTARA", "ARRIVAL", "21 OCT", RED_INK, -8);
  rectStamp(R + 330, 520, 200, 56, ["HARBOUR STAMP", "FERRY MV LIRIA"], RED_INK, -6);
  roundStamp(R + 120, 600, "KALNARA", "ARRIVAL", "09 NOV", INK, 6);

  // Ferry line, typed under the stamps: the crossing the endorsements
  // box warned about, now stamped and done.
  text(R + 16, 640, "FERRY: OSTARA - TARNOVO, MV LIRIA, 09 NOV 2026", 1, INK_SOFT, 1);
  text(R + 16, 656, "NEXT PAGE: P. 13", 1, INK_SOFT, 1);
}

// ------------------------------------------------------------------ main

function fail(message: string): never {
  console.error(`error: ${message}`);
  process.exit(1);
}

function main(): void {
  const outDir = process.env.MAKEFUN_OUTPUT_DIR?.trim() || process.env.OUTPUT_DIR?.trim() || "/output";
  mkdirSync(outDir, { recursive: true });
  drawSpread();
  const png = encodePng();
  if (png.length > 1048576) {
    fail(`entry.png is ${png.length} bytes, over the 1,048,576 byte cap`);
  }
  const dest = join(outDir, "entry.png");
  writeFileSync(dest, png);
  if (png[0] !== 0x89 || png[1] !== 0x50 || png[2] !== 0x4e || png[3] !== 0x47) {
    fail("entry.png does not start with PNG magic bytes");
  }
  console.log(`ok: wrote ${dest} (${png.length} bytes, ${W}x${H})`);
}

try {
  main();
} catch (err) {
  const detail = err instanceof Error ? err.message : String(err);
  console.error(`error: ${detail}`);
  process.exit(1);
}
