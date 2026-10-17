#!/usr/bin/env node
// Сборка атласов спрайтов: src/assets/raw/<раса>/** → public/atlases/<раса>.png|json (PixiJS spritesheet).
// Без зависимостей: PNG читается и пишется через node:zlib. Имя кадра = имя файла с расширением
// (совпадает с basename поля `sprite` в данных героев и крипов).
// shortcut: только 8-бит PNG без interlace (типы 0, 2, 3, 4, 6); атлас до 2048×2048, без поворотов и обрезки.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW = path.join(ROOT, 'src/assets/raw');
const OUT = path.join(ROOT, 'public/atlases');
const MAX = 2048;
const PAD = 1;
const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function paeth(a, b, c) {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

function decodePng(buf) {
  if (!buf.subarray(0, 8).equals(SIG)) throw new Error('не PNG');
  let ihdr = null, plte = null, trns = null;
  const idat = [];
  for (let off = 8; off < buf.length;) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    off += 12 + len;
    if (type === 'IHDR') ihdr = { w: data.readUInt32BE(0), h: data.readUInt32BE(4), depth: data[8], ctype: data[9], interlace: data[12] };
    else if (type === 'PLTE') plte = data;
    else if (type === 'tRNS') trns = data;
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
  }
  if (!ihdr) throw new Error('нет IHDR');
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ihdr.ctype];
  if (!channels || ihdr.depth !== 8 || ihdr.interlace !== 0) throw new Error('поддерживается только 8-бит PNG без interlace');
  if (ihdr.ctype === 3 && !plte) throw new Error('палитровый PNG без PLTE');

  const { w, h } = ihdr;
  const stride = w * channels;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(w * h * 4);
  let prev = Buffer.alloc(stride);
  for (let y = 0, p = 0; y < h; y++) {
    const filter = raw[p++];
    const line = Buffer.from(raw.subarray(p, p + stride));
    p += stride;
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? line[i - channels] : 0;
      const b = prev[i];
      const c = i >= channels ? prev[i - channels] : 0;
      const add = [0, a, b, (a + b) >> 1, paeth(a, b, c)][filter];
      if (add === undefined) throw new Error(`неизвестный фильтр ${filter}`);
      line[i] = (line[i] + add) & 255;
    }
    for (let x = 0; x < w; x++) {
      const si = x * channels, di = (y * w + x) * 4;
      let r, g, b, al = 255;
      if (ihdr.ctype === 0) r = g = b = line[si];
      else if (ihdr.ctype === 4) { r = g = b = line[si]; al = line[si + 1]; }
      else if (ihdr.ctype === 3) {
        const idx = line[si];
        r = plte[idx * 3]; g = plte[idx * 3 + 1]; b = plte[idx * 3 + 2];
        al = trns && idx < trns.length ? trns[idx] : 255;
      } else {
        r = line[si]; g = line[si + 1]; b = line[si + 2];
        if (ihdr.ctype === 6) al = line[si + 3];
      }
      out[di] = r; out[di + 1] = g; out[di + 2] = b; out[di + 3] = al;
    }
    prev = line;
  }
  return { w, h, data: out };
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function encodePng(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8 бит, RGBA
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  return Buffer.concat([SIG, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/** Полочная упаковка при фиксированной ширине. null — не влезло в MAX по высоте. */
function shelf(frames, W) {
  let x = 0, y = 0, rowH = 0;
  for (const f of frames) {
    if (f.w > W) return null;
    if (x + f.w > W) { x = 0; y += rowH + PAD; rowH = 0; }
    f.x = x; f.y = y;
    x += f.w + PAD;
    rowH = Math.max(rowH, f.h);
  }
  const H = y + rowH;
  return H <= MAX ? H : null;
}

function nextPow2(n) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    return e.name.toLowerCase().endsWith('.png') ? [p] : [];
  });
}

function packRace(race, files) {
  const images = new Map();
  for (const file of files) {
    const name = path.basename(file);
    if (images.has(name)) throw new Error(`${race}: дубликат имени кадра ${name}`);
    images.set(name, { name, ...decodePng(fs.readFileSync(file)), file });
  }
  const frames = [...images.values()].sort((a, b) => b.h - a.h || b.w - a.w);

  let W = 256, H = null;
  for (; W <= MAX && H === null; W *= 2) H = shelf(frames, W);
  if (H === null) throw new Error(`${race}: кадры не влезли в ${MAX}×${MAX}`);
  W /= 2;
  H = nextPow2(H);

  const atlas = Buffer.alloc(W * H * 4);
  const json = { frames: {}, meta: { app: 'scripts/pack-atlas.mjs', image: `${race}.png`, format: 'RGBA8888', size: { w: W, h: H }, scale: '1' } };
  for (const f of frames) {
    for (let y = 0; y < f.h; y++) f.data.copy(atlas, ((f.y + y) * W + f.x) * 4, y * f.w * 4, (y + 1) * f.w * 4);
    json.frames[f.name] = {
      frame: { x: f.x, y: f.y, w: f.w, h: f.h }, rotated: false, trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: f.w, h: f.h }, sourceSize: { w: f.w, h: f.h },
    };
  }
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, `${race}.png`), encodePng(W, H, atlas));
  fs.writeFileSync(path.join(OUT, `${race}.json`), JSON.stringify(json, null, 2) + '\n');
  console.log(`${race}: ${frames.length} кадров → ${W}×${H}`);
}

function main() {
  const races = fs.existsSync(RAW)
    ? fs.readdirSync(RAW, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name).sort()
    : [];
  const packed = [];
  for (const race of races) {
    const files = walk(path.join(RAW, race));
    if (files.length === 0) continue;
    packRace(race, files);
    packed.push(race);
  }
  if (packed.length === 0) {
    console.log('нет исходников');
    return;
  }
  fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify({ races: packed }, null, 2) + '\n');
}

try {
  main();
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
