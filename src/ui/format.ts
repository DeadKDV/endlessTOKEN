// Форматирование чисел: до 1e6 — обычное, дальше суффиксы, после 1e33 — экспонента.
const SUFFIX = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No'];
export function fmt(n: number): string {
  if (!Number.isFinite(n)) return '∞';
  if (n < 1e3) return n.toFixed(n < 10 ? 1 : 0);
  const e = Math.floor(Math.log10(n) / 3);
  if (e < SUFFIX.length) return (n / Math.pow(1000, e)).toFixed(2) + SUFFIX[e];
  return n.toExponential(2);
}
