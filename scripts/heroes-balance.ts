// Сила героев по отдельности: каждый один в отряде, уровень и форма одинаковые - до какого этажа дойдёт.
// Выбросы вверх/вниз - кандидаты на правку способностей. Запуск: npx vite-node scripts/heroes-balance.ts [уровень] [форма]
import { createBattle, runToEnd } from '../src/sim/battle';
import { buildParty, newGameState, HEROES } from '../src/sim/party';

const LVL = Number(process.argv[2] ?? 40);
const FORM = Number(process.argv[3] ?? 0) as 0 | 1 | 2;

function reach(id: string): number {
  const s = newGameState(0);
  s.heroes = { [id]: { lvl: LVL, form: FORM, pet: FORM === 2 ? 10 : 0, artifacts: [], floorsInParty: 0 } };
  s.party = [id];
  const p = buildParty(s);
  let lo = 1, hi = 400; // двоичный поиск последнего проходимого этажа
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (runToEnd(createBattle(mid, p, 1), 3000).result === 'win') lo = mid; else hi = mid - 1;
  }
  return lo;
}

const rows = HEROES.map(h => ({ id: h.id, race: h.race, role: h.role, floor: reach(h.id) })).sort((a, b) => b.floor - a.floor);
const avg = rows.reduce((a, r) => a + r.floor, 0) / rows.length;
for (const r of rows) console.log(`${r.id.padEnd(10)} ${r.race.padEnd(7)} ${r.role.padEnd(8)} ${String(r.floor).padStart(4)} ${r.floor > avg * 1.25 ? 'СИЛЬНЕЕ' : r.floor < avg * 0.75 ? 'СЛАБЕЕ' : ''}`);
console.log(`среднее ${avg.toFixed(1)} (ур. ${LVL}, форма ${FORM})`);
