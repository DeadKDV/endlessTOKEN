// Числа как в idle-играх: 999, 1.23K, 45.6M, 7.89B, 1.2T, потом aa, ab, … (aa = 1e15, ab = 1e18, …).
const NAMED = ['', 'K', 'M', 'B', 'T'];
const LETTERS = 26 * 26;

function suffix(g: number): string | null {
  if (g < NAMED.length) return NAMED[g];
  const i = g - NAMED.length;
  return i < LETTERS ? String.fromCharCode(97 + Math.floor(i / 26), 97 + (i % 26)) : null;
}

/** Мантисса (1 ≤ m < 10) и десятичный порядок; строки вида "1.5e400" (Decimal) читаются без потери порядка. */
function split(x: number | string): { m: number; e: number } | null {
  const s = typeof x === 'number' ? x.toExponential(12) : String(x).trim().toLowerCase();
  const r = /^([+-]?\d*\.?\d+)(?:e([+-]?\d+))?$/.exec(s);
  if (!r) return null;
  const [mm, ee] = Number(r[1]).toExponential(12).split('e');
  return { m: Number(mm), e: Number(ee) + Number(r[2] ?? 0) };
}

export function fmt(n: number | string): string {
  if (typeof n === 'number' && Number.isNaN(n)) return '0';
  if (n === Infinity || n === -Infinity) return n < 0 ? '-∞' : '∞';
  if (typeof n === 'string' && n.trim().startsWith('-')) return '-' + fmt(n.trim().slice(1));
  if (typeof n === 'number' && n < 0) return '-' + fmt(-n);
  const p = split(n);
  if (!p || p.m === 0) return '0';
  const v = p.e < 3 ? p.m * Math.pow(10, p.e) : Infinity;
  if (v < 999.5) return String(+v.toFixed(v < 10 ? 1 : 0));
  let g = Math.floor(p.e / 3);
  const scaled = p.m * Math.pow(10, p.e % 3);
  const digits = scaled < 10 ? 2 : scaled < 100 ? 1 : 0;
  let r = +scaled.toFixed(digits);
  if (r >= 1000) { r = 1; g++; }
  const suf = suffix(g);
  return suf === null ? `${p.m.toFixed(2)}e${p.e}` : String(r) + suf;
}
