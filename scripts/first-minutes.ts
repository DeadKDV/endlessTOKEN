// Первые минуты новичка: когда хватит на первые уровни героя (золото за убитых зачисляется сразу).
// Запуск: npx vite-node scripts/first-minutes.ts
import { createBattle, step } from '../src/sim/battle';
import { buildParty, newGameState } from '../src/sim/party';
import { heroLevelCost } from '../src/sim/economy';

const s = newGameState(0);
let gold = 0, t = 0, floor = 1;
const buys: string[] = [];
while (t < 600 && buys.length < 10) {
  const b = createBattle(floor, buildParty(s), 1);
  while (!b.finished && b.tick < 3000) {
    step(b); t += 0.1; gold += b.goldEarned; b.goldEarned = 0;
    while (gold >= heroLevelCost(s.heroes.alderic.lvl)) {
      gold -= heroLevelCost(s.heroes.alderic.lvl); s.heroes.alderic.lvl++;
      buys.push(`${t.toFixed(0)}с→ур.${s.heroes.alderic.lvl}`);
    }
  }
  gold += b.goldEarned;
  floor = b.finished === 'win' ? floor + 1 : Math.max(1, floor - 1);
}
console.log(`за ${t.toFixed(0)} с: этаж ${floor}; покупки: ${buys.join(' ')}`);
