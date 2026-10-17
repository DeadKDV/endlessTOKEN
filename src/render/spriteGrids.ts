/** Чистая часть процедурных спрайтов: сетки пикселей из ключей палитры (без DOM, тестируется в node). */
import type { CreepType, Race, Role } from '../sim/types';
import races from '../data/races.json';

export type Grid = string[][];
export type RGBA = [number, number, number, number];
export interface SpriteSpec {
  kind: 'hero' | 'creep' | 'mob' | 'boss' | 'base';
  race: Race;
  enemy: boolean;
  role?: Role;
  ctype?: CreepType;
  form?: number;
  raid?: boolean;
}

export const specKey = (s: SpriteSpec) =>
  [s.kind, s.race, s.enemy ? 'e' : 'p', s.role ?? '', s.ctype ?? '', s.form ?? 0, s.raid ? 'r' : ''].join('|');

const mk = (w: number, h: number): Grid => Array.from({ length: h }, () => Array<string>(w).fill(''));
function R(g: Grid, x: number, y: number, w: number, h: number, k: string) {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (g[j]?.[i] !== undefined) g[j][i] = k;
}
function P(g: Grid, x: number, y: number, k: string) { R(g, x, y, 1, 1, k); }
function stamp(g: Grid, x: number, y: number, rows: string[]) {
  rows.forEach((row, j) => [...row].forEach((c, i) => { if (c !== '.') P(g, x + i, y + j, c); }));
}

/** Особенности головы по расе: x0,y0,w,h — кожа лица, top — верх шлема. */
function features(g: Grid, race: Race, x0: number, y0: number, w: number, h: number, top: number) {
  const r = x0 + w - 1;
  if (race === 'undead') {
    R(g, r - 2, y0, 2, 2, 'e');
    for (let i = x0 + 1; i < r; i += 2) P(g, i, y0 + h - 1, 'o');
  } else if (race === 'orc') {
    R(g, r - 3, y0, 3, 1, 'd');
    P(g, r - 3, y0 + h - 1, 'W');
    P(g, r, y0 + h - 1, 'W');
  } else if (race === 'dwarf') {
    R(g, x0, y0 + h - 2, w, 3, 'b');
  } else if (race === 'elf') {
    P(g, x0 - 1, y0 + 1, 's'); P(g, x0 - 2, y0, 's');
    P(g, r + 1, y0 + 1, 's'); P(g, r + 2, y0, 's');
  } else {
    R(g, x0 + 2, top - 1, 3, 1, 'c'); // султан на шлеме
  }
}

const BOW = ['hh..', '.hh.', '..hw', '..hw', '..hw', '..hw', '..hw', '.hh.', 'hh..'];

function hero(race: Race, role: Role): Grid {
  const g = mk(20, 24);
  R(g, 7, 17, 3, 5, 'd'); R(g, 11, 17, 3, 5, 'd');
  if (role === 'mage') R(g, 5, 16, 11, 7, 'a');
  R(g, 6, 22, 4, 2, 'k'); R(g, 11, 22, 4, 2, 'k');
  R(g, 6, 10, 9, 7, 'a'); R(g, 4, 10, 2, 6, 'a'); R(g, 15, 10, 2, 6, 'a');
  R(g, 4, 16, 2, 1, 's'); R(g, 15, 16, 2, 1, 's');
  R(g, 6, 15, 9, 1, 'c'); R(g, 9, 11, 3, 3, 'c');
  R(g, 7, 6, 7, 4, 's'); R(g, 7, 3, 7, 3, role === 'ranger' ? 'c' : 'a'); R(g, 7, 5, 7, 1, 'd'); P(g, 12, 7, 'e');
  features(g, race, 7, 6, 7, 4, 3);
  if (role === 'tank') { R(g, 15, 9, 4, 9, 'c'); R(g, 16, 10, 2, 7, 'a'); R(g, 16, 12, 2, 2, 'W'); R(g, 6, 3, 9, 1, 'c'); }
  else if (role === 'fighter') { R(g, 17, 2, 1, 12, 'w'); R(g, 16, 13, 3, 1, 'g'); R(g, 17, 14, 1, 3, 'h'); }
  else if (role === 'ranger') stamp(g, 16, 8, BOW);
  else if (role === 'mage') {
    R(g, 6, 3, 9, 3, ''); R(g, 6, 5, 9, 1, 'a'); R(g, 8, 3, 5, 2, 'a'); R(g, 9, 2, 3, 1, 'a');
    R(g, 17, 4, 1, 17, 'h'); R(g, 16, 1, 3, 3, 'g'); P(g, 16, 1, 'W');
  } else { R(g, 17, 2, 1, 19, 'h'); R(g, 18, 3, 2, 5, 'c'); P(g, 18, 5, 'W'); }
  return g;
}

function creep(race: Race, type: CreepType): Grid {
  const g = mk(16, 16);
  R(g, 5, 11, 2, 4, 'd'); R(g, 9, 11, 2, 4, 'd'); R(g, 4, 15, 3, 1, 'k'); R(g, 9, 15, 3, 1, 'k');
  R(g, 4, 6, 8, 5, 'a'); R(g, 3, 6, 1, 4, 'a'); R(g, 12, 6, 1, 4, 'a'); R(g, 4, 9, 8, 1, 'c');
  R(g, 5, 2, 6, 4, 's'); R(g, 4, 1, 8, 2, 'a'); P(g, 9, 3, 'e');
  features(g, race, 5, 2, 6, 4, 1);
  if (type === 'infantry') { R(g, 13, 3, 1, 8, 'w'); R(g, 12, 10, 3, 1, 'g'); }
  else if (type === 'ranged') stamp(g, 12, 4, BOW.slice(0, 7));
  else { R(g, 13, 3, 1, 12, 'h'); R(g, 13, 0, 1, 3, 'W'); R(g, 12, 1, 3, 1, 'W'); }
  return g;
}

/** Враги — монстры, не люди: череп, зверь, слизень, голем по расе; дальники несут светящийся шар. */
function monster(race: Race, ranged: boolean): Grid {
  const shape = ({ undead: 'skull', orc: 'beast', human: 'beast', elf: 'slime', dwarf: 'golem' } as const)[race];
  let g: Grid;
  if (shape === 'skull') {
    g = mk(16, 14);
    R(g, 3, 1, 10, 7, 'W'); R(g, 2, 3, 12, 4, 'W'); R(g, 4, 4, 3, 3, 'e'); R(g, 9, 4, 3, 3, 'e');
    P(g, 5, 5, 'c'); P(g, 10, 5, 'c'); R(g, 7, 7, 2, 1, 'e'); R(g, 4, 8, 8, 3, 'W');
    for (let x = 4; x < 12; x += 2) P(g, x, 9, 'e');
    R(g, 3, 12, 2, 2, 'a'); R(g, 7, 13, 2, 1, 'a'); R(g, 11, 12, 2, 2, 'a');
  } else if (shape === 'beast') {
    g = mk(20, 13);
    R(g, 4, 3, 12, 6, 'a'); R(g, 14, 2, 5, 5, 'a'); P(g, 17, 3, 'c'); R(g, 17, 7, 2, 1, 'W');
    P(g, 14, 1, 'W'); P(g, 18, 1, 'W'); R(g, 5, 9, 2, 4, 'd'); R(g, 9, 9, 2, 4, 'd'); R(g, 13, 9, 2, 4, 'd');
    R(g, 1, 4, 3, 1, 'd'); for (let x = 5; x < 15; x += 3) R(g, x, 1, 1, 2, 'd');
  } else if (shape === 'slime') {
    g = mk(16, 12);
    R(g, 2, 6, 12, 6, 'a'); R(g, 4, 3, 8, 3, 'a'); R(g, 3, 5, 10, 1, 'a'); R(g, 5, 4, 2, 1, 'W');
    R(g, 5, 7, 2, 2, 'W'); P(g, 6, 8, 'e'); R(g, 10, 7, 2, 2, 'W'); P(g, 11, 8, 'e'); R(g, 6, 10, 4, 1, 'e'); R(g, 2, 11, 12, 1, 'd');
  } else {
    g = mk(16, 16);
    R(g, 3, 5, 10, 7, 'S'); R(g, 0, 6, 3, 7, 'S'); R(g, 13, 6, 3, 7, 'S'); R(g, 5, 1, 6, 5, 'S');
    P(g, 6, 3, 'c'); P(g, 9, 3, 'c'); R(g, 4, 12, 3, 4, 'T'); R(g, 9, 12, 3, 4, 'T'); R(g, 7, 7, 1, 3, 'T');
  }
  if (ranged) { const x = g[0].length - 4; R(g, x, 0, 3, 3, 'c'); P(g, x + 1, 1, 'W'); }
  return g;
}

function boss(race: Race, raid: boolean): Grid {
  const s = monster(race, false);
  if (raid) R(s, 0, 0, 1, 1, 'g');
  const g = mk(s[0].length * 3, s.length * 3);
  s.forEach((row, y) => row.forEach((k, x) => { if (k) R(g, x * 3, y * 3, 3, 3, k); }));
  return g;
}

/** Вражеская крепость: две башни с остроконечными крышами цвета расы мобов, ворота, стяг. */
function fortress(): Grid {
  const g = mk(40, 60);
  R(g, 4, 26, 32, 34, 'S');
  for (let y = 30; y < 60; y += 6) R(g, 4, y, 32, 1, 'T');
  for (let x = 4; x < 36; x += 6) R(g, x, 22, 4, 4, 'S');
  R(g, 1, 14, 9, 46, 'S'); R(g, 30, 14, 9, 46, 'S');
  for (let i = 0; i < 6; i++) { R(g, 1 + i, 14 - i - 1, 9 - 2 * i, 1, 'a'); R(g, 31 + i, 14 - i - 1, 9 - 2 * i, 1, 'a'); }
  for (let y = 18; y < 58; y += 6) { R(g, 1, y + 5, 9, 1, 'T'); R(g, 30, y + 5, 9, 1, 'T'); }
  R(g, 5, 20, 1, 4, 'e'); R(g, 34, 20, 1, 4, 'e');
  R(g, 15, 40, 10, 20, 'e'); R(g, 16, 38, 8, 2, 'e'); R(g, 17, 36, 6, 2, 'e');
  for (let x = 17; x < 24; x += 3) R(g, x, 38, 1, 22, 'T');
  R(g, 20, 4, 1, 18, 'h'); R(g, 21, 4, 8, 6, 'a'); R(g, 23, 6, 2, 2, 'W');
  return g;
}

/** Наш лагерь: шатёр со знаменем цвета расы за частоколом. */
function camp(): Grid {
  const g = mk(36, 44);
  for (let y = 12; y < 31; y++) { const hw = Math.round((y - 12) * 0.8); R(g, 18 - hw, y, 2 * hw + 1, 1, 'W'); }
  R(g, 17, 14, 3, 17, 'a'); R(g, 16, 24, 5, 7, 'e'); P(g, 18, 10, 'g'); R(g, 18, 11, 1, 2, 'h');
  R(g, 2, 33, 32, 11, 'h');
  for (let x = 2; x < 34; x += 4) { R(g, x, 30, 3, 3, 'h'); R(g, x + 3, 31, 1, 13, 'k'); }
  R(g, 14, 35, 8, 9, 'e');
  R(g, 3, 2, 1, 31, 'h'); P(g, 3, 1, 'g'); R(g, 4, 3, 10, 7, 'a'); R(g, 6, 5, 3, 3, 'c');
  R(g, 32, 22, 1, 11, 'h'); R(g, 31, 20, 3, 2, 'g');
  return g;
}

function finish(g: Grid, halo: boolean): Grid {
  const H = g.length, W = g[0].length;
  const at = (a: Grid, x: number, y: number) => a[y]?.[x] ?? '';
  const out = g.map(r => r.slice());
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!g[y][x] && (at(g, x - 1, y) || at(g, x + 1, y) || at(g, x, y - 1) || at(g, x, y + 1))) out[y][x] = 'o';
  }
  if (!halo) return out;
  const o2 = out.map(r => r.slice());
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (out[y][x]) continue;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (at(out, x + i, y + j)) o2[y][x] = 'H';
  }
  return o2;
}

export function buildGrid(s: SpriteSpec): Grid {
  let g: Grid;
  if (s.kind === 'hero') g = hero(s.race, s.role ?? 'fighter');
  else if (s.kind === 'boss') g = boss(s.race, !!s.raid);
  else if (s.kind === 'base') g = s.enemy ? fortress() : camp();
  else if (s.kind === 'mob') g = monster(s.race, s.ctype === 'ranged');
  else g = creep(s.race, s.ctype ?? 'infantry');
  return finish(g, (s.kind === 'hero' && (s.form ?? 0) >= 2) || !!s.raid);
}

const SKIN: Record<Race, string> = { undead: '#d9d2c5', orc: '#7cb342', elf: '#ecd2aa', dwarf: '#e0a77c', human: '#f0c8a0' };
const hex = (h: string): [number, number, number] => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
const shade = (c: [number, number, number], k: number, a = 255): RGBA => [c[0] * k | 0, c[1] * k | 0, c[2] * k | 0, a];

export function paletteOf(s: SpriteSpec): Record<string, RGBA> {
  const p = (races.races as Record<string, { palette: string[] }>)[s.race].palette;
  const k = s.enemy ? 0.75 : 1;
  const accent = hex(s.race === 'undead' || s.race === 'dwarf' ? p[2] : p[3]);
  const gold = (s.form ?? 0) >= 1 || s.raid;
  const outline: RGBA = gold ? [255, 213, 79, 255] : s.enemy ? [176, 42, 42, 255] : [16, 16, 24, 255];
  const wall: Record<string, RGBA> = s.kind === 'base' && s.enemy ? { S: [88, 88, 104, 255], T: [58, 58, 72, 255] } : { S: [138, 138, 154, 255], T: [95, 95, 112, 255] };
  return {
    o: outline, H: [255, 213, 79, 90],
    a: shade(hex(p[1]), k), d: shade(hex(p[1]), 0.55 * k), c: shade(accent, s.enemy ? 0.85 : 1),
    s: shade(hex(SKIN[s.race]), s.enemy ? 0.88 : 1), k: [42, 29, 18, 255], w: [207, 216, 220, 255],
    h: [141, 110, 99, 255], g: [255, 213, 79, 255], W: [245, 245, 245, 255], e: [16, 16, 24, 255],
    b: [192, 118, 58, 255], ...wall,
  };
}
