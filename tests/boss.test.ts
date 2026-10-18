import { describe, it, expect } from 'vitest';
import { createBattle, runToEnd, step, type PartyMember } from '../src/sim/battle';
import { spawnWave } from '../src/sim/floor';
import { applyAbilities, atkOf, dealDamage, isStunned } from '../src/sim/abilities';
import { bossAbilities } from '../src/sim/bosses';
import { buildParty, newGameState } from '../src/sim/party';
import { mulberry32 } from '../src/sim/rng';
import type { BattleState, Stats, Unit } from '../src/sim/types';

const tough: Stats = { hp: 1e12, atk: 1, atkSpeed: 1, crit: 0, critDmg: 1.5, range: 1, moveSpeed: 1 };
const member = (stats: Stats = tough): PartyMember => ({ heroId: 'x', race: 'undead', stats, abilities: [], creeps: [] });

/** Арена: только босс этажа floor на x=5 и герои на заданных x; ничего не двигается - тики гоним через applyAbilities. */
function arena(floor: number, heroXs: number[], only?: string[]) {
  const s = createBattle(floor, heroXs.map(() => member()), 1);
  const boss = spawnWave(floor, 3, 0).find(u => u.kind === 'boss')!;
  boss.pending = false; boss.alive = true; boss.x = 5;
  s.units = [...s.units.filter(u => u.side === 'party' && u.kind === 'hero'), boss];
  s.units.filter(u => u.side === 'party').forEach((u, i) => { u.alive = true; u.pending = false; u.spawnAt = undefined; u.x = heroXs[i]; });
  if (only) boss.cds = boss.abilities!.map(a => (only.includes(a.id) ? 0 : 1e9));
  return { s, boss, heroes: s.units.filter(u => u.side === 'party') };
}
const tick = (s: BattleState, n = 1) => { for (let i = 0; i < n; i++) { applyAbilities(s, mulberry32(1)); s.tick++; } };
const lost = (u: Unit) => u.maxHp - u.hp;

describe('приёмы боссов', () => {
  it('набор по расе этажа, у рейд-босса все четыре', () => {
    expect(bossAbilities('elf', false).map(a => a.id)).toEqual(['boss_slam', 'boss_roar']);
    expect(bossAbilities('undead', true).length).toBe(4);
  });

  it('замах объявляется заранее, удар по площади бьёт только в радиусе', () => {
    const { s, boss, heroes } = arena(10, [3, 3.8, 0], ['boss_slam']); // этаж 10 - эльфы: слэм + рёв
    tick(s, 1);
    const w = boss.effects!.find(e => e.k === 'windup')!;
    expect(w.v).toBe(3.8); // центр - ближайший враг
    expect(w.until - s.tick).toBeGreaterThan(1); // до удара есть время
    tick(s, 4);
    expect(heroes.map(lost)).toEqual([0, 0, 0]); // замах ещё идёт - урона нет
    tick(s, 3);
    expect(lost(heroes[0])).toBeGreaterThan(0);
    expect(lost(heroes[1])).toBe(lost(heroes[0]));
    expect(lost(heroes[2])).toBe(0); // вне радиуса
  });

  it('оглушение в замахе срывает удар', () => {
    const { s, boss, heroes } = arena(10, [3], ['boss_slam']);
    tick(s, 1);
    boss.effects!.push({ k: 'stun', v: 1, until: s.tick + 100 });
    expect(isStunned(boss, s.tick)).toBe(true);
    tick(s, 10);
    expect(lost(heroes[0])).toBe(0);
  });

  it('ярость включается ниже порога HP', () => {
    const { s, boss } = arena(40, [3], []); // этаж 40 - гномы: слэм + ярость
    boss.cds = boss.abilities!.map(() => 1e9);
    tick(s, 1);
    const base = atkOf(boss, s.tick);
    boss.hp = boss.maxHp * 0.25;
    tick(s, 1);
    expect(atkOf(boss, s.tick)).toBeCloseTo(base * 1.5);
  });

  it('зов призывает мобов без золота и не больше cap', () => {
    const { s, boss } = arena(20, [3], ['boss_summon']); // этаж 20 - люди: зов + рёв
    const mobs = () => s.units.filter(u => u.side === 'enemy' && u.temp && u.alive);
    tick(s, 1);
    expect(mobs().length).toBe(2);
    boss.cds![boss.abilities!.findIndex(a => a.id === 'boss_summon')] = 0;
    tick(s, 1);
    boss.cds![boss.abilities!.findIndex(a => a.id === 'boss_summon')] = 0;
    tick(s, 1);
    expect(mobs().length).toBe(4);
    const gold = s.goldEarned;
    dealDamage(s, s.units[0], mobs()[0], 1e12, mulberry32(1)); // убитый призванный золота не даёт
    expect(mobs().length).toBe(3);
    expect(s.goldEarned).toBe(gold);
  });

  it('рёв оглушает отряд на 1 с', () => {
    const { s, heroes } = arena(10, [3, 4], ['boss_roar']);
    tick(s, 1);
    expect(heroes.every(h => isStunned(h, s.tick))).toBe(true);
    tick(s, 10);
    expect(heroes.some(h => isStunned(h, s.tick))).toBe(false);
  });
});

describe('таймер рейд-босса', () => {
  it('не убили за raidBossTimerSec - поражение раньше лимита этажа', () => {
    const s = createBattle(50, [member()], 1);
    let armed = -1;
    while (!s.finished && s.tick < 6000) {
      step(s);
      if (armed < 0 && s.raidUntil !== undefined) armed = s.tick;
    }
    expect(s.finished).toBe('lose');
    expect(s.raidUntil! - armed).toBeLessThanOrEqual(900);
    expect(s.tick).toBeGreaterThanOrEqual(s.raidUntil!);
    expect(s.tick).toBeLessThan(3000);
  });
  it('сильный отряд успевает: таймер снимается со смертью босса', () => {
    const s = createBattle(50, [member({ ...tough, atk: 1e14 })], 1);
    const r = runToEnd(s);
    expect(r.result).toBe('win');
    expect(s.raidUntil).toBeUndefined();
  });
  it('на обычном боссе таймера нет', () => {
    const s = createBattle(10, [member()], 1);
    for (let i = 0; i < 1500; i++) step(s);
    expect(s.raidUntil).toBeUndefined();
  });
});

describe('детерминизм', () => {
  it('босс-этаж по seed повторяется до тика', () => {
    const g = newGameState(0); g.heroes.alderic.lvl = 30;
    const p = buildParty(g);
    const a = runToEnd(createBattle(20, p, 5), 6000), b = runToEnd(createBattle(20, p, 5), 6000);
    expect(a).toEqual(b);
  });
});
