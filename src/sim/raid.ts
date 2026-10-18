// Рейд дня (одиночный): босс расы дня с огромным HP, 3 захода по 60 с, награда по нанесённому урону.
import economy from '../data/economy.json';
import races from '../data/races.json';
import { mobAtk } from './economy';
import { makeUnit } from './floor';
import { bossAbilities, bossFirstCds } from './bosses';
import { createBattle, partyDps, step, type PartyMember } from './battle';
import { localDate } from './party';
import type { BattleState, GameState, Race, WaveGen } from './types';

const R = economy.guild.raid;
export const RAID_ID = 'raid';
export const RAID_MAX_TICKS = Math.round(R.entrySec * 1000 / economy.tickMs);

export interface RaidSave { date: string; used: number; best: number; record: number; pending: boolean }
export interface RaidReward { petFood?: number; gems?: number; crystals?: number }
export interface RaidResult { race: Race; damage: number; tier: number; reward: RaidReward; newRecord: boolean }

declare module './types' {
  interface GameState { raid?: RaidSave }
}

export const newRaid = (): RaidSave => ({ date: '', used: 0, best: 0, record: 0, pending: false });

/** Раса босса дня: по номеру дня календаря, поэтому два дня подряд расы не повторяются. */
export function raidRace(date: string): Race {
  const [y, m, d] = date.split('-').map(Number);
  const ring = races.ring as Race[];
  return ring[Math.floor(Date.UTC(y, m - 1, d) / 86_400_000) % ring.length];
}

/** Состояние рейда на сегодня: при смене локальной даты заходы и дневной лучший урон обнуляются, рекорд остаётся. */
export function raidToday(s: GameState, nowMs: number): RaidSave {
  const r = s.raid ?? newRaid(); const today = localDate(nowMs);
  return r.date === today ? r : { ...r, date: today, used: 0, best: 0 };
}
export const raidEntriesLeft = (s: GameState, nowMs: number) => Math.max(0, R.entries - raidToday(s, nowMs).used);

/** Списать заход. Не меняет сейв, если заходов нет. */
export function spendRaidEntry(s: GameState, nowMs: number): GameState {
  if (raidEntriesLeft(s, nowMs) <= 0) return s;
  const r = raidToday(s, nowMs);
  return { ...s, raid: { ...r, used: r.used + 1, pending: true } };
}

/** Этаж, по которому считается сила босса: доля от лучшего этажа забега. */
export const raidScaleFloor = (s: GameState) => Math.max(1, Math.floor(s.runMaxFloor * R.floorScale));

/** Пороги урона за заход (ступени наград): доли от «номинала» - DPS отряда × длительность захода. */
export const raidTiers = (party: PartyMember[]): number[] => R.tierMult.map(m => Math.round(m * partyDps(party) * R.entrySec));
export const raidTierOf = (damage: number, tiers: number[]) => tiers.filter(x => damage >= x).length;
export const raidRewardOf = (tier: number): RaidReward => (R.rewards as RaidReward[])[tier - 1] ?? {};

/** Босс не умирает за заход: HP = hpDpsMult × DPS × hpSeconds (как у гильдейского рейда, но от одного отряда). */
function raidWaveGen(race: Race, floor: number, hp: number): WaveGen {
  return (wave, startX) => {
    if (wave > 1) return [];
    const b = makeUnit('boss', race, 'raid_boss', startX + 0.5, hp, mobAtk(floor) * R.atkMult, 1.0, 2);
    b.abilities = bossAbilities(race, true);
    b.cds = bossFirstCds(b.abilities);
    return [b];
  };
}

export function createRaidBattle(s: GameState, party: PartyMember[], seed: number, nowMs: number): BattleState {
  const floor = raidScaleFloor(s);
  const hp = Math.max(1, partyDps(party)) * R.hpDpsMult * R.hpSeconds;
  return createBattle(floor, party, seed, raidWaveGen(raidRace(localDate(nowMs)), floor, hp));
}

const bossOf = (b: BattleState) => b.units.find(u => u.refId === 'raid_boss');
/** Нанесённый боссу урон: потеря его HP. */
export function raidDamage(b: BattleState): number {
  const u = bossOf(b);
  return u ? Math.max(0, u.maxHp - Math.max(0, u.hp)) : 0;
}

/** Тик боя рейда: по истечении 60 с бой заканчивается. */
export function stepRaid(b: BattleState): BattleState {
  if (b.tick >= RAID_MAX_TICKS) { b.finished = 'win'; return b; }
  return step(b);
}

/** Итог захода: награда по ступени, дневной лучший урон и рекорд. Срабатывает один раз на заход (флаг pending). */
export function settleRaid(s: GameState, damage: number, tiers: number[], nowMs: number): { state: GameState; result: RaidResult } | null {
  const r = raidToday(s, nowMs);
  if (!r.pending) return null;
  const tier = raidTierOf(damage, tiers); const reward = raidRewardOf(tier);
  const newRecord = damage > r.record;
  return {
    result: { race: raidRace(r.date), damage, tier, reward, newRecord },
    state: {
      ...s,
      gems: s.gems + (reward.gems ?? 0), petFood: s.petFood + (reward.petFood ?? 0), crystals: s.crystals + (reward.crystals ?? 0),
      raid: { ...r, pending: false, best: Math.max(r.best, damage), record: Math.max(r.record, damage) },
    },
  };
}
