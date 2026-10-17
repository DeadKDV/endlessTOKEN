import economy from '../data/economy.json';
import { partyArtifactSum } from './artifacts';
import type { GameState } from './types';

export function crystalsFor(maxFloor: number, tavernLevel: number): number {
  const base = Math.floor(economy.prestige.crystalScale * Math.pow(maxFloor / economy.prestige.divisor, economy.prestige.power));
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

/** Множитель золота: кристаллы × артефакты золота × вечная покупка за самоцветы (×1.1). */
export function goldMult(s: GameState): number {
  return (1 + s.crystals * economy.prestige.crystalGoldMultPer) * (1 + partyArtifactSum(s, 'gold_mult'))
    * (s.perks.permGold ? economy.gems.permanentGold.mult : 1);
}

/** Бесплатный одноразовый стартовый набор: самоцветы, золото, корм петомцев. */
export function claimStarterPack(s: GameState): GameState {
  if (s.perks.starterPack) return s;
  const p = economy.gems.starterPack;
  return {
    ...s, gems: s.gems + p.gems, gold: (Number(s.gold) + p.gold).toString(), petFood: s.petFood + p.petFood,
    perks: { ...s.perks, starterPack: true },
  };
}

/** Магазин: постоянный ×1.1 к золоту за 1000 самоцветов, один раз. */
export function buyPermGold(s: GameState): GameState {
  const c = economy.gems.permanentGold.cost;
  if (s.perks.permGold || s.gems < c) return s;
  return { ...s, gems: s.gems - c, perks: { ...s.perks, permGold: true } };
}
