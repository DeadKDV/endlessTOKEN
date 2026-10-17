import economy from '../data/economy.json';
import { partyArtifactSum } from './artifacts';
import type { GameState } from './types';

export function crystalsFor(maxFloor: number, tavernLevel: number): number {
  const base = Math.floor(Math.pow(maxFloor / economy.prestige.divisor, economy.prestige.power));
  return Math.floor(base * (1 + economy.prestige.tavernPerLevel * tavernLevel));
}

/** Множитель от кристаллов: применяется к урону и золоту. */
export function crystalMult(crystals: number): number {
  return 1 + crystals * economy.prestige.crystalAtkMultPer;
}

/** Сколько кристаллов даст воскрешение сейчас: этаж забега, Таверна и артефакты кристаллов. */
export function prestigeGain(s: GameState): number {
  return Math.floor(crystalsFor(s.runMaxFloor, s.base.tavern ?? 0) * (1 + partyArtifactSum(s, 'crystal_mult')));
}

/** Сброс при престиже: этаж, золото, уровни героев. Деревня, база, петомцы, формы, артефакты, ресурсы остаются. */
export function applyPrestige(s: GameState): GameState {
  const gained = prestigeGain(s);
  if (gained < 1) return s;
  const heroes: GameState['heroes'] = {};
  for (const [id, h] of Object.entries(s.heroes)) heroes[id] = { ...h, lvl: 1 };
  return { ...s, floor: 1, runMaxFloor: 1, gold: '0', crystals: s.crystals + gained, heroes };
}
