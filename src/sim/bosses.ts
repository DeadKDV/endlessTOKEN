/** Приёмы боссов: набор по расе этажа, у рейд-босса - все. Числа в economy.boss; исполняет их abilities.ts. */
import economy from '../data/economy.json';
import type { Ability, Race } from './types';

const BOSS = economy.boss as unknown as { firstCdFrac: number; raidCdMult: number; byRace: Record<string, string[]>; abilities: Record<string, Omit<Ability, 'id'>> };
const TPS = 1000 / economy.tickMs;

export function bossAbilities(race: Race, raid: boolean): Ability[] {
  const ids = raid ? Object.keys(BOSS.abilities) : BOSS.byRace[race] ?? [];
  return ids.map(k => {
    const a: Ability = { ...BOSS.abilities[k], id: `boss_${k}` };
    if (raid && a.cooldown) a.cooldown *= BOSS.raidCdMult;
    return a;
  });
}

/** Стартовая перезарядка: босс не бьёт в первую же секунду после выхода. */
export const bossFirstCds = (abs: Ability[]) => abs.map(a => Math.ceil((a.cooldown ?? 0) * TPS * BOSS.firstCdFrac));
