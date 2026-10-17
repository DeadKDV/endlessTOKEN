import economy from '../data/economy.json';
import type { GameState } from './types';

export function crystalsFor(maxFloor: number, tavernLevel: number): number {
  const base = Math.floor(Math.pow(maxFloor / economy.prestige.divisor, economy.prestige.power));
  return Math.floor(base * (1 + economy.prestige.tavernPerLevel * tavernLevel));
}

/** Множитель от кристаллов: применяется к урону и золоту. */
export function crystalMult(crystals: number): number {
  return 1 + crystals * economy.prestige.crystalAtkMultPer;
}

/** Сброс при престиже: возвращает новый стейт (иммутабельно). */
export function applyPrestige(s: GameState): GameState {
  const gained = crystalsFor(s.maxFloor, s.base.tavern ?? 0);
  const heroes: GameState['heroes'] = {};
  for (const [id, h] of Object.entries(s.heroes)) heroes[id] = { ...h, lvl: 1 };
  return { ...s, floor: 1, gold: '0', crystals: s.crystals + gained, heroes };
}
