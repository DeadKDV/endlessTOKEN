// Проходимость боссовых этажей: герой ур. L + деревня уровня V (казармы, полигон, лазарет) против босса этажа F.
// Запуск: npx vite-node scripts/boss.ts   
import economy from '../src/data/economy.json';
import { createBattle, runToEnd } from '../src/sim/battle';
import { buildParty, newGameState } from '../src/sim/party';

// BOSS=off - без приёмов боссов и без таймера рейда (базовая линия)
if (process.env.BOSS === 'off') { (economy as any).boss.abilities = {}; economy.floor.raidBossTimerSec = 1e6; }

function run(f: number, lvl: number, v: number) {
  const s = newGameState(0);
  s.heroes.alderic.lvl = lvl;
  for (const r of ['undead', 'elf', 'dwarf', 'human', 'orc']) s.village[`barracks_${r}`] = v;
  s.village.range = v; s.village.infirmary = v;
  const b = createBattle(f, buildParty(s), 1);
  const r = runToEnd(b, 6000);
  return `${r.result === 'win' ? 'W' : 'L'}${Math.round(r.ticks / 10)}`;
}

const grid: [number, number[]][] = [[9, [10, 20]], [10, [10, 15, 20]], [11, [10, 20]], [20, [20, 25, 30]], [30, [30, 40]], [40, [40, 50]], [50, [50, 60, 65, 70, 75, 80]]];
for (const [f, lvls] of grid) {
  for (const lvl of lvls) console.log(`F${f} L${lvl}: ` + [0, 10, 20, 40].map(v => `V${v}=${run(f, lvl, v)}`).join('  '));
}
