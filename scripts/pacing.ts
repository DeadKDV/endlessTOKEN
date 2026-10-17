// Темп игры: один герой, всё золото в его уровень, при поражении откат на этаж (как в game.ts).
// Запуск: npx vite-node scripts/pacing.ts
import { createBattle, runToEnd } from '../src/sim/battle';
import { buildParty, newGameState } from '../src/sim/party';
import { heroLevelCost } from '../src/sim/economy';

const s = newGameState(0);
let gold = 0, floor = 1, sec = 0, best = 1;
const marks = [5, 10, 15, 20, 25, 30, 40, 50];
while (sec < 6 * 3600 && marks.length) {
  const r = runToEnd(createBattle(floor, buildParty(s), sec | 0), 3000);
  sec += r.ticks / 10; gold += r.gold;
  floor = r.result === 'win' ? floor + 1 : Math.max(1, floor - 1);
  while (gold >= heroLevelCost(s.heroes.alderic.lvl)) { gold -= heroLevelCost(s.heroes.alderic.lvl); s.heroes.alderic.lvl++; }
  if (floor > best) { best = floor; while (marks.length && best >= marks[0]) console.log(`этаж ${marks.shift()}: ${(sec / 60).toFixed(1)} мин, ур. ${s.heroes.alderic.lvl}`); }
}
console.log(`за ${(sec / 3600).toFixed(1)} ч: лучший этаж ${best}, ур. ${s.heroes.alderic.lvl}`);
