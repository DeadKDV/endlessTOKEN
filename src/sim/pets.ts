import economy from '../data/economy.json';
import { petFoodCost } from './economy';
import { buildingById, buildingLevel } from './buildings';
import type { GameState } from './types';

const P = economy.pets;

/** Корм на переход L → L+1 (с L = 0 переходить нельзя — петомец приходит яйцом). */
export const feedCost = (level: number) => petFoodCost(level + 1);

export function feedPet(s: GameState, id: string): GameState {
  const h = s.heroes[id];
  if (!h || h.pet < 1 || h.pet >= P.maxLevel) return s;
  const cost = feedCost(h.pet);
  if (s.petFood < cost) return s;
  return { ...s, petFood: s.petFood - cost, heroes: { ...s.heroes, [id]: { ...h, pet: h.pet + 1 } } };
}

/** Яйцо: первый герой без петомца — сначала по порядку отряда, потом остальные. null — у всех уже есть. */
export function eggRecipient(s: GameState): string | null {
  const order = [...s.party, ...Object.keys(s.heroes)];
  return order.find(id => s.heroes[id] && s.heroes[id].pet === 0) ?? null;
}

/** Босс 10-го этажа побеждён: корм всегда, яйцо — если этаж пройден впервые за всё время. */
export function onBossCleared(s: GameState, floor: number): { state: GameState; egg: string | null } {
  if (floor % P.eggEveryFloors !== 0) return { state: s, egg: null };
  let state: GameState = { ...s, petFood: s.petFood + P.foodPerBoss };
  const first = floor >= s.maxFloor;
  const egg = first ? eggRecipient(s) : null;
  // первое прохождение боссового этажа даёт кристаллы - чтобы было кем заполнять слоты отряда до воскрешения
  if (first) state = { ...state, crystals: state.crystals + Math.floor(floor / economy.prestige.bossFirstClearCrystalsPer) };
  if (egg) state = { ...state, heroes: { ...state.heroes, [egg]: { ...state.heroes[egg], pet: 1 } } };
  return { state, egg };
}

/** Дневной корм: базовый + 1 за каждые 5 ур. Псарни; раз в сутки (дата локальная). */
export function dailyFoodAmount(s: GameState): number {
  const e = buildingById('kennel')!.effect;
  return P.dailyFood + Math.floor(buildingLevel(s, 'kennel') / e.perLevels) * e.add;
}

export function claimDailyFood(s: GameState, today: string): GameState {
  if (s.dailyFoodDay === today) return s;
  return { ...s, petFood: s.petFood + dailyFoodAmount(s), dailyFoodDay: today };
}
