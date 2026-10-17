// Ежедневные задания и достижения. Чистые функции над GameState; поле сейва v5 — quests.
import data from '../data/quests.json';
import { mulberry32 } from './rng';
import { localDate } from './party';
import { floorGold } from './economy';
import type { GameState } from './types';

/** Счётчики событий. Лучший этаж и число героев берутся прямо из сейва (maxFloor, heroes). */
export const STAT_KEYS = ['floorsCleared', 'bossesKilled', 'levelsBought', 'buildingLevels', 'prestiges', 'dungeonsRun', 'adsWatched'] as const;
export type StatKey = (typeof STAT_KEYS)[number];
export type Stats = Record<StatKey, number>;

/** Виды заданий и счётчик, которым они меряются. */
export const DAILY_STAT: Record<string, StatKey> = {
  floors: 'floorsCleared', bosses: 'bossesKilled', levels: 'levelsBought', buildings: 'buildingLevels', ads: 'adsWatched', dungeons: 'dungeonsRun',
};

export interface Reward { gems?: number; petFood?: number; goldMin?: number }
export interface DailyQuest { id: string; kind: string; target: number; reward: Reward; progress: number; done: boolean; claimed: boolean }
export interface QuestsSave {
  stats: Stats;
  day: string;
  dayStats: Stats;
  daily: string[];       // id заданий дня: "вид:номер ступени"
  dailyClaimed: string[];
  chestClaimed: boolean;
  ach: Record<string, number>; // достижение → сколько ступеней уже забрано
}

declare module './types' {
  interface GameState { quests?: QuestsSave }
}

const zeroStats = (): Stats => Object.fromEntries(STAT_KEYS.map(k => [k, 0])) as Stats;
export const newQuests = (): QuestsSave => ({ stats: zeroStats(), day: '', dayStats: zeroStats(), daily: [], dailyClaimed: [], chestClaimed: false, ach: {} });

const dailyKinds = (dungeons: boolean) => Object.keys(data.daily).filter(k => dungeons || k !== 'dungeons');
const tierOf = (kind: string, i: number) => (data.daily as Record<string, (Reward & { target: number })[]>)[kind][i];

/** 5 заданий дня: зависят только от даты (и от того, открыты ли подземелья). */
export function generateDaily(date: string, dungeons: boolean): string[] {
  const rnd = mulberry32([...date].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261));
  const kinds = dailyKinds(dungeons);
  for (let i = kinds.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [kinds[i], kinds[j]] = [kinds[j], kinds[i]]; }
  return kinds.slice(0, data.dailyCount).map(k => `${k}:${Math.floor(rnd() * (data.daily as Record<string, unknown[]>)[k].length)}`);
}

/** Сейв с актуальным днём: при смене даты задания перегенерируются, дневной прогресс обнуляется. */
export function syncQuests(s: GameState, nowMs: number): GameState {
  const day = localDate(nowMs);
  const q = s.quests ?? newQuests();
  if (s.quests && q.day === day) return s;
  const dungeons = (s.base.portal ?? 0) >= 1;
  return { ...s, quests: { ...q, day, dayStats: zeroStats(), daily: generateDaily(day, dungeons), dailyClaimed: [], chestClaimed: false } };
}

/** Записать события (например { floorsCleared: 1 }) в общие и дневные счётчики. */
export function recordEvent(s: GameState, nowMs: number, ev: Partial<Stats>): GameState {
  const n = syncQuests(s, nowMs); const q = n.quests!;
  const add = (st: Stats) => Object.fromEntries(STAT_KEYS.map(k => [k, st[k] + (ev[k] ?? 0)])) as Stats;
  return { ...n, quests: { ...q, stats: add(q.stats), dayStats: add(q.dayStats) } };
}

export function dailyQuests(s: GameState): DailyQuest[] {
  const q = s.quests; if (!q) return [];
  return q.daily.map(id => {
    const [kind, i] = id.split(':'); const tier = tierOf(kind, Number(i));
    const progress = Math.min(tier.target, q.dayStats[DAILY_STAT[kind]]);
    return { id, kind, target: tier.target, reward: { gems: tier.gems, petFood: tier.petFood, goldMin: tier.goldMin }, progress, done: progress >= tier.target, claimed: q.dailyClaimed.includes(id) };
  });
}
export const chestReady = (s: GameState) => { const d = dailyQuests(s); return d.length > 0 && d.every(x => x.claimed) && !s.quests!.chestClaimed; };
export const CHEST_REWARD: Reward = data.chest;

function give(s: GameState, r: Reward): GameState {
  return {
    ...s, gems: s.gems + (r.gems ?? 0), petFood: s.petFood + (r.petFood ?? 0),
    // золото как у рекламы «Ресурсы»: доход этажа × 360 за «час», здесь минуты
    gold: r.goldMin ? (Number(s.gold) + floorGold(s.floor) * 6 * r.goldMin).toString() : s.gold,
  };
}

export function claimDaily(s: GameState, nowMs: number, id: string): GameState {
  const n = syncQuests(s, nowMs); const q = dailyQuests(n).find(x => x.id === id);
  if (!q || !q.done || q.claimed) return s;
  return { ...give(n, q.reward), quests: { ...n.quests!, dailyClaimed: [...n.quests!.dailyClaimed, id] } };
}
export function claimChest(s: GameState, nowMs: number): GameState {
  const n = syncQuests(s, nowMs);
  if (!chestReady(n)) return s;
  return { ...give(n, CHEST_REWARD), quests: { ...n.quests!, chestClaimed: true } };
}

export interface Achievement { id: string; value: number; steps: number[]; gems: number[]; claimed: number; ready: number; nextTarget: number | null }
const statValue = (s: GameState, stat: string) =>
  stat === 'maxFloor' ? s.maxFloor : stat === 'heroes' ? Object.keys(s.heroes).length : (s.quests ?? newQuests()).stats[stat as StatKey];

export function achievements(s: GameState): Achievement[] {
  return data.achievements.map(a => {
    const value = statValue(s, a.stat); const claimed = s.quests?.ach[a.id] ?? 0;
    const reached = a.steps.filter(x => value >= x).length;
    return { id: a.id, value, steps: a.steps, gems: a.gems, claimed, ready: Math.max(0, reached - claimed), nextTarget: a.steps[claimed] ?? null };
  });
}
export function claimAchievement(s: GameState, id: string): GameState {
  const a = achievements(s).find(x => x.id === id);
  if (!a || a.ready < 1) return s;
  const gems = a.gems.slice(a.claimed, a.claimed + a.ready).reduce((x, y) => x + y, 0);
  const q = s.quests ?? newQuests();
  return { ...s, gems: s.gems + gems, quests: { ...q, ach: { ...q.ach, [id]: a.claimed + a.ready } } };
}

/** Есть ли что забрать (отметка на кнопке «Задания»). */
export function questsClaimable(s: GameState, nowMs: number): boolean {
  const n = syncQuests(s, nowMs);
  return dailyQuests(n).some(x => x.done && !x.claimed) || chestReady(n) || achievements(n).some(a => a.ready > 0);
}
