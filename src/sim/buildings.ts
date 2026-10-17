import data from '../data/buildings.json';
import { buildingCost } from './economy';
import type { GameState } from './types';

export interface BuildingDef {
  id: string; zone: 'village' | 'base'; maxLevel: number; costBase: number; costGrowth: number;
  name: { ru: string; en: string }; effect: { kind: string; [k: string]: any };
}
export const BUILDINGS = data as BuildingDef[];
export const buildingById = (id: string) => BUILDINGS.find(b => b.id === id);

export const buildingLevel = (s: GameState, id: string) => {
  const b = buildingById(id);
  return b ? (b.zone === 'village' ? s.village : s.base)[id] ?? 0 : 0;
};

/** Цена перехода L → L+1 в очках этажа (округляется вверх). */
export function buildingUpgradeCost(b: BuildingDef, level: number): number {
  return Math.ceil(buildingCost(b.costBase, b.costGrowth, level));
}

/** Сколько уровней (≤count) можно купить на бюджет и во сколько они обойдутся. count = 'max' — сколько хватит. */
export function affordable(costAt: (level: number) => number, level: number, maxLevel: number, budget: number, count: number | 'max'): { n: number; cost: number } {
  const want = count === 'max' ? Infinity : count;
  let n = 0; let cost = 0;
  while (n < want && level + n < maxLevel) {
    const c = costAt(level + n);
    if (cost + c > budget) break;
    cost += c; n++;
  }
  return { n, cost };
}

export function buyBuilding(s: GameState, id: string, count: number | 'max' = 1): GameState {
  const b = buildingById(id); if (!b) return s;
  const lvl = buildingLevel(s, id);
  const { n, cost } = affordable(L => buildingUpgradeCost(b, L), lvl, b.maxLevel, s.floorPoints, count);
  if (n === 0) return s;
  return { ...s, floorPoints: s.floorPoints - cost, [b.zone]: { ...s[b.zone], [id]: lvl + n } };
}

/** Эффекты Полигона (атака крипов) и Лазарета (лечение, HP пехоты). */
export function villageMods(s: GameState) {
  const range = buildingById('range')!.effect; const inf = buildingById('infirmary')!.effect;
  const r = buildingLevel(s, 'range'); const i = buildingLevel(s, 'infirmary');
  return { creepAtk: 1 + r * range.perLevel, heal: 1 + i * inf.healPerLevel, infantryHp: 1 + i * inf.infantryHpPerLevel };
}

/** Уровень Портала, с которого открыто подземелье. */
export function dungeonUnlockLevel(dungeonId: string): number {
  return buildingById('portal')!.effect.unlocks[dungeonId] ?? Infinity;
}
