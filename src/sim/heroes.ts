import economy from '../data/economy.json';
import { heroLevelCost } from './economy';
import { affordable } from './buildings';
import { heroById } from './party';
import type { CreepType, GameState } from './types';

/** Покупка уровней героя за золото: ×1 / ×10 / 'max'. */
export function buyHeroLevels(s: GameState, id: string, count: number | 'max' = 1): GameState {
  const h = s.heroes[id]; if (!h) return s;
  const { n, cost } = affordable(heroLevelCost, h.lvl, Infinity, Number(s.gold), count);
  if (n === 0) return s;
  return { ...s, gold: (Number(s.gold) - cost).toString(), heroes: { ...s.heroes, [id]: { ...h, lvl: h.lvl + n } } };
}

/** Слоты отряда по максимальному этажу: 1/10/25/50/100 → 1..5. */
export function partySlots(maxFloor: number): number {
  return economy.party.slotsAtFloor.filter(f => maxFloor >= f).length;
}

/** Добавить героя в отряд (если есть свободный слот) или убрать из него (последнего убрать нельзя). */
export function togglePartyMember(s: GameState, id: string): GameState {
  if (!s.heroes[id]) return s;
  if (s.party.includes(id)) return s.party.length > 1 ? { ...s, party: s.party.filter(x => x !== id) } : s;
  if (s.party.length >= partySlots(s.maxFloor)) return s;
  return { ...s, party: [...s.party, id] };
}

/** Сдвинуть героя в порядке отряда (порядок влияет на выдачу яиц). dir: -1 влево, +1 вправо. */
export function movePartyMember(s: GameState, id: string, dir: -1 | 1): GameState {
  const i = s.party.indexOf(id); const j = i + dir;
  if (i < 0 || j < 0 || j >= s.party.length) return s;
  const party = [...s.party]; [party[i], party[j]] = [party[j], party[i]];
  return { ...s, party };
}

/** Цена призыва в кристаллах: первые герои дёшевы, каждый следующий дороже (как в Endless Frontier). */
export function summonCost(s: GameState): number {
  const owned = Math.max(1, Object.keys(s.heroes).length);
  return Math.round(economy.prestige.heroSummonCost * Math.pow(economy.prestige.heroSummonGrowth, owned - 1));
}

/** Призыв нового героя: за кристаллы предков или за самоцветы (вне очереди). */
export function summonHero(s: GameState, id: string, pay: 'crystals' | 'gems' = 'crystals'): GameState {
  if (s.heroes[id] || !heroById(id)) return s;
  const cost = pay === 'crystals' ? summonCost(s) : economy.gems.heroSummon;
  if (s[pay] < cost) return s;
  return { ...s, [pay]: s[pay] - cost, heroes: { ...s.heroes, [id]: { lvl: 1, form: 0, pet: 0, artifacts: [], floorsInParty: 0 } } };
}

/** Слайдер состава крипов: меняем пехоту или дальников, хилеры забирают остаток. */
export function setCreepMix(s: GameState, type: 'infantry' | 'ranged', value: number): GameState {
  const other: CreepType = type === 'infantry' ? 'ranged' : 'infantry';
  const v = Math.min(1, Math.max(0, value));
  const o = Math.min(s.creepMix[other], 1 - v);
  return { ...s, creepMix: { ...s.creepMix, [type]: v, [other]: o, healer: 1 - v - o } };
}
