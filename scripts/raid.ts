// Калибровка рейда дня: урон за заход и ступени наград при разных этажах/уровнях/расах босса.
// Запуск: npx vite-node scripts/raid.ts
import { partyDps } from '../src/sim/battle';
import { buildParty, newGameState } from '../src/sim/party';
import { RAID_MAX_TICKS, createRaidBattle, raidDamage, raidTierOf, raidTiers, stepRaid } from '../src/sim/raid';

const days = ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16'];
for (const [floor, lvl, v] of [[5, 10, 0], [20, 30, 10], [50, 60, 20], [100, 120, 40], [200, 250, 60]]) {
  const s = newGameState(0); s.heroes.alderic.lvl = lvl; s.runMaxFloor = floor; s.maxFloor = floor;
  for (const r of ['undead', 'elf', 'dwarf', 'human', 'orc']) s.village[`barracks_${r}`] = v;
  s.village.range = v; s.village.infirmary = v;
  const p = buildParty(s); const tiers = raidTiers(p);
  const out = days.map(d => {
    const now = new Date(d + 'T12:00:00').getTime();
    const b = createRaidBattle(s, p, 1, now);
    while (!b.finished) stepRaid(b);
    const dmg = raidDamage(b);
    return `${b.units.find(u => u.refId === 'raid_boss')!.race}:${(dmg / (partyDps(p) * 60)).toFixed(2)}x/T${raidTierOf(dmg, tiers)}${b.tick < RAID_MAX_TICKS ? `(end ${b.tick})` : ''}`;
  });
  console.log(`F${floor} L${lvl} V${v} dps=${Math.round(partyDps(p))}: ` + out.join('  '));
}
