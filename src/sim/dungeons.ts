import economy from '../data/economy.json';
import dungeonData from '../data/dungeons.json';
import { mobAtk, mobHp } from './economy';
import { makeUnit } from './floor';
import { buildingLevel, dungeonUnlockLevel } from './buildings';
import { createBattle, step, type PartyMember } from './battle';
import { localDate } from './party';
import type { BattleState, GameState, Race, WaveGen } from './types';

const D = economy.dungeons;

export interface DungeonDef { id: string; race: Race; resource: keyof GameState['resources'] }
export const DUNGEONS = dungeonData as DungeonDef[];
export const dungeonById = (id: string) => DUNGEONS.find(d => d.id === id);

export const dungeonUnlocked = (s: GameState, id: string) => buildingLevel(s, 'portal') >= dungeonUnlockLevel(id);

/** Счётчик входов за сегодня: если дата сменилась (локальная полночь) — все входы сброшены. */
export function normalizeRuns(runs: GameState['dungeonRuns'], nowMs: number): GameState['dungeonRuns'] {
  const today = localDate(nowMs);
  return runs.date === today ? runs : { date: today };
}
export function runsLeft(s: GameState, id: string, nowMs: number): number {
  const used = Number(normalizeRuns(s.dungeonRuns, nowMs)[id] ?? 0);
  return Math.max(0, D.runsPerDay - used);
}
/** Списать вход. Не меняет состояние, если нечего списывать или подземелье закрыто. */
export function spendRun(s: GameState, id: string, nowMs: number): GameState {
  if (!dungeonById(id) || !dungeonUnlocked(s, id) || runsLeft(s, id, nowMs) <= 0) return s;
  const runs = normalizeRuns(s.dungeonRuns, nowMs);
  return { ...s, dungeonRuns: { ...runs, [id]: Number(runs[id] ?? 0) + 1 } };
}
/** Сброс кулдаунов за самоцветы: все входы на сегодня снова доступны. */
export function resetRuns(s: GameState, nowMs: number): GameState {
  if (s.gems < economy.gems.dungeonReset) return s;
  return { ...s, gems: s.gems - economy.gems.dungeonReset, dungeonRuns: { date: localDate(nowMs) } };
}

/** Этаж, по которому считается сила мобов подземелья: доля от лучшего этажа забега. */
export const dungeonScaleFloor = (s: GameState) => Math.max(1, Math.floor(s.runMaxFloor * D.floorScale));

/** Волны мобов одной расы без базы; с каждой волной мобы сильнее на waveGrowth. */
export function dungeonWaveGen(race: Race, scaleFloor: number): WaveGen {
  return (wave, startX) => {
    const k = Math.pow(D.waveGrowth, wave - 1);
    const hp = mobHp(scaleFloor) * k; const atk = mobAtk(scaleFloor) * k;
    return Array.from({ length: economy.floor.mobsPerWave }, (_, i) => {
      const ranged = i % 3 === 2;
      return makeUnit('mob', race, ranged ? 'mob_ranged' : 'mob_melee', startX + i * 0.6, hp * (ranged ? 0.6 : 1), atk, 1.0, ranged ? 5 : 1);
    });
  };
}

export const DUNGEON_MAX_TICKS = Math.round(D.durationSec * 1000 / economy.tickMs);

export function createDungeonBattle(s: GameState, id: string, party: PartyMember[], seed: number): BattleState {
  const d = dungeonById(id)!;
  const floor = dungeonScaleFloor(s);
  return createBattle(floor, party, seed, dungeonWaveGen(d.race, floor));
}

/** Тик боя подземелья: по истечении 60 с бой заканчивается. */
export function stepDungeon(b: BattleState): BattleState {
  if (b.tick >= DUNGEON_MAX_TICKS) { b.finished = 'win'; return b; }
  return step(b);
}

/** Ресурс за бой = полностью выбитые волны × resourcePerWave. */
export function dungeonReward(b: BattleState): number {
  return Math.max(0, b.wave - 1) * D.resourcePerWave;
}
export function grantDungeonReward(s: GameState, id: string, amount: number): GameState {
  const d = dungeonById(id);
  return d ? { ...s, resources: { ...s.resources, [d.resource]: s.resources[d.resource] + amount } } : s;
}
