// Подбор параметров боя с базами: исход отдельных боёв при разных интервалах волн и прочности баз.
// Запуск: npx vite-node scripts/why.ts
import economy from '../src/data/economy.json';
import { createBattle, step } from '../src/sim/battle';
import { buildParty, newGameState } from '../src/sim/party';

for (const [we, pb, eb] of [[20, 5, 10], [20, 5, 12], [22, 5, 10], [22, 5, 12], [22, 4, 12], [24, 4, 12]]) {
  economy.battle.waveEverySec = we; economy.battle.partyBaseHpMult = pb; economy.mob.baseHpMult = eb;
  const row: string[] = [];
  for (const [lvl, f] of [[1, 1], [1, 3], [5, 3], [10, 6], [10, 8], [20, 11], [20, 14]]) {
    const s0 = newGameState(0); s0.heroes.alderic.lvl = lvl;
    const b = createBattle(f, buildParty(s0), 1);
    while (!b.finished && b.tick < 6000) step(b);
    const e = b.units.find(u => u.side === 'enemy' && u.kind === 'base')!;
    row.push(`L${lvl}F${f}:${b.finished ?? 'time'}@${(b.tick / 10) | 0}s w${b.wave} eb${Math.round(100 * e.hp / e.maxHp)}%`);
  }
  console.log(`волна ${we}с, наша база x${pb}, их база x${eb}: ` + row.join('  '));
}
