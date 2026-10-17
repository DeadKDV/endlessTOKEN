import economy from '../data/economy.json';
import type { GameState } from './types';

const U = economy.hero.formUnlock;

/** Пробуждение (форма 1): 50 этажей с героем в отряде + 500 очков этажа. */
export function canAwaken(s: GameState, id: string): boolean {
  const h = s.heroes[id];
  return !!h && h.form === 0 && h.floorsInParty >= U.awakening.floors && s.floorPoints >= U.awakening.floorPoints;
}
export function awaken(s: GameState, id: string): GameState {
  if (!canAwaken(s, id)) return s;
  return { ...s, floorPoints: s.floorPoints - U.awakening.floorPoints, heroes: { ...s.heroes, [id]: { ...s.heroes[id], form: 1 } } };
}

/** Союз (форма 2): герой уже пробуждён, петомец достиг 10 ур. */
export function canUnite(s: GameState, id: string): boolean {
  const h = s.heroes[id];
  return !!h && h.form === 1 && h.pet >= U.union.petLevel;
}
export function unite(s: GameState, id: string): GameState {
  if (!canUnite(s, id)) return s;
  return { ...s, heroes: { ...s.heroes, [id]: { ...s.heroes[id], form: 2 } } };
}
