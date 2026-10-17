import data from '../data/artifacts.json';
import type { GameState } from './types';

export interface ArtifactDef {
  id: string; branch: string; resource: 'bone' | 'leaf' | 'ore' | 'seal' | 'totem';
  name: { ru: string; en: string };
  effect: { kind: string; atLevel1?: number; atLevel50?: number; [k: string]: unknown };
}
export const ARTIFACTS = data.artifacts as ArtifactDef[];
export const artifactById = (id: string) => ARTIFACTS.find(a => a.id === id);

/** Эффект артефакта: линейная интерполяция atLevel1 → atLevel50 по уровню 1..maxLevel. */
export function artifactValue(a: ArtifactDef, level: number): number {
  const { atLevel1: v1, atLevel50: v50 } = a.effect;
  if (v1 === undefined || v50 === undefined || level <= 0) return 0;
  return v1 + (v50 - v1) * (Math.min(level, data.maxLevel) - 1) / (data.maxLevel - 1);
}

/** Цена перехода с уровня L на L+1: price × 1.5^L. */
export function artifactUpgradeCost(level: number): number {
  return Math.ceil(data.price * Math.pow(data.upgradeGrowth, level));
}

/** Слоты артефактов героя по его уровню: 0 до 50, потом 1/2/3 на 50/100/150. */
export function artifactSlots(heroLevel: number): number {
  return data.slotsAtHeroLevel.filter(l => heroLevel >= l).length;
}

export const ARTIFACT_PRICE = data.price;
export const ARTIFACT_MAX_LEVEL = data.maxLevel;

export function buyArtifact(s: GameState, id: string): GameState {
  const a = artifactById(id);
  if (!a || s.artifacts[id] || s.resources[a.resource] < data.price) return s;
  return { ...s, resources: { ...s.resources, [a.resource]: s.resources[a.resource] - data.price }, artifacts: { ...s.artifacts, [id]: 1 } };
}

export function upgradeArtifact(s: GameState, id: string): GameState {
  const a = artifactById(id); const lvl = s.artifacts[id];
  if (!a || !lvl || lvl >= data.maxLevel) return s;
  const cost = artifactUpgradeCost(lvl);
  if (s.resources[a.resource] < cost) return s;
  return { ...s, resources: { ...s.resources, [a.resource]: s.resources[a.resource] - cost }, artifacts: { ...s.artifacts, [id]: lvl + 1 } };
}

/** Надеть артефакт на героя (снимается с прежнего владельца). Нужен свободный слот. */
export function equipArtifact(s: GameState, heroId: string, id: string): GameState {
  const h = s.heroes[heroId];
  if (!h || !s.artifacts[id] || h.artifacts.includes(id) || h.artifacts.length >= artifactSlots(h.lvl)) return s;
  const heroes = Object.fromEntries(Object.entries(s.heroes).map(([k, v]) => [k, { ...v, artifacts: v.artifacts.filter(x => x !== id) }]));
  heroes[heroId] = { ...heroes[heroId], artifacts: [...heroes[heroId].artifacts, id] };
  return { ...s, heroes };
}

export function unequipArtifact(s: GameState, heroId: string, id: string): GameState {
  const h = s.heroes[heroId];
  if (!h || !h.artifacts.includes(id)) return s;
  return { ...s, heroes: { ...s.heroes, [heroId]: { ...h, artifacts: h.artifacts.filter(x => x !== id) } } };
}

/** Сумма эффектов по виду (kind) среди надетых артефактов героя; учитываются только открытые слоты. */
export function heroArtifactSum(s: GameState, heroId: string): Record<string, number> {
  const h = s.heroes[heroId]; const out: Record<string, number> = {};
  if (!h) return out;
  for (const id of h.artifacts.slice(0, artifactSlots(h.lvl))) {
    const a = artifactById(id); const lvl = s.artifacts[id];
    if (a && lvl) out[a.effect.kind] = (out[a.effect.kind] ?? 0) + artifactValue(a, lvl);
  }
  return out;
}

/** Сумма эффектов вида kind по всем героям отряда — для глобальных артефактов (золото, очки, оффлайн…). */
export function partyArtifactSum(s: GameState, kind: string): number {
  return s.party.reduce((sum, id) => sum + (heroArtifactSum(s, id)[kind] ?? 0), 0);
}
