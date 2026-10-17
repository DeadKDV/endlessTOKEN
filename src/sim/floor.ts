import economy from '../data/economy.json';
import { baseHp, mobAtk, mobHp } from './economy';
import { mobRaceForFloor } from './races';
import type { Unit } from './types';

let nextId = 1;
export function resetIds() { nextId = 1; }
export function newId() { return nextId++; }

const F = economy.floor;

export function isBossFloor(n: number) { return n % F.bossEvery === 0; }
export function isRaidBossFloor(n: number) { return n % F.raidBossEvery === 0; }

/** Мобы волны w (1-based) этажа n. Последняя волна — босс или база. */
export function spawnWave(n: number, w: number, startX: number): Unit[] {
  const race = mobRaceForFloor(n);
  const hp = mobHp(n);
  const atk = mobAtk(n);
  const units: Unit[] = [];
  const isLast = w === F.wavesPerFloor;
  if (isLast) {
    // вражеская база всегда в конце
    units.push(makeUnit('base', race, 'enemy_base', startX + 4, baseHp(n), 0, 0, 0));
    if (isRaidBossFloor(n)) units.push(makeUnit('boss', race, 'raid_boss', startX + 2, hp * F.raidBossHpMult, atk * 3, 1.0, 2));
    else if (isBossFloor(n)) units.push(makeUnit('boss', race, 'boss', startX + 2, hp * F.bossHpMult, atk * 2, 1.0, 1.5));
  }
  const count = isLast ? Math.ceil(F.mobsPerWave / 2) : F.mobsPerWave;
  for (let i = 0; i < count; i++) {
    const ranged = i % 3 === 2;
    units.push(makeUnit('mob', race, ranged ? 'mob_ranged' : 'mob_melee', startX + i * 0.6, hp * (ranged ? 0.6 : 1), atk, 1.0, ranged ? 5 : 1));
  }
  return units;
}

function makeUnit(kind: Unit['kind'], race: Unit['race'], refId: string, x: number, hp: number, atk: number, atkSpeed: number, range: number): Unit {
  return {
    id: newId(), side: 'enemy', race, kind, refId, x,
    hp, maxHp: hp,
    stats: { hp, atk, atkSpeed, crit: 0, critDmg: 1.5, range, moveSpeed: kind === 'base' ? 0 : 0.8 },
    attackCooldown: 0, alive: true,
  };
}

/** Суммарное HP всех врагов этажа — для оценки времени оффлайна. */
export function totalFloorHp(n: number): number {
  let total = 0;
  for (let w = 1; w <= F.wavesPerFloor; w++) for (const u of spawnWave(n, w, 0)) total += u.maxHp;
  return total;
}
