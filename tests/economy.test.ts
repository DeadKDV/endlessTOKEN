import { describe, it, expect } from 'vitest';
import { mobHp, floorGold, floorPoints, heroLevelCost, heroAtk, creepCap, offlineHours } from '../src/sim/economy';
import { raceMult, mobRaceForFloor, partyBonus } from '../src/sim/races';
import { crystalsFor } from '../src/sim/prestige';
import { computeOffline } from '../src/sim/offline';

describe('формулы из DESIGN.md', () => {
  it('HP моба: 50·1.11^n·1.5^floor(n/10)', () => {
    expect(mobHp(0)).toBeCloseTo(80);
    expect(mobHp(10)).toBeCloseTo(80 * Math.pow(1.11, 10) * 1.5, 5);
  });
  it('золото и очки этажа', () => {
    expect(floorGold(0)).toBe(10);
    expect(floorPoints(4)).toBe(1);
    expect(floorPoints(5)).toBe(2);
    expect(floorPoints(137)).toBe(28);
  });
  it('стоимость уровня геометрическая', () => {
    expect(heroLevelCost(0)).toBe(3);
    expect(heroLevelCost(10) / heroLevelCost(9)).toBeCloseTo(1.094);
  });
  it('атака героя: веха ×1.5 каждые 10 уровней, формы 1/1.8/3.2', () => {
    expect(heroAtk(20, 10, 0) / heroAtk(20, 9, 0)).toBeCloseTo(1.07 * 1.5);
    expect(heroAtk(20, 5, 2) / heroAtk(20, 5, 0)).toBeCloseTo(3.2);
  });
  it('лимит крипов 4/6/10 + петомец + знамёнщик', () => {
    expect(creepCap(0, 0, 0)).toBe(4);
    expect(creepCap(2, 10, 50)).toBe(10 + 2 + 2);
  });
  it('оффлайн-лимит 8→24 ч', () => {
    expect(offlineHours(0)).toBe(8);
    expect(offlineHours(160)).toBe(24);
    expect(offlineHours(1000)).toBe(24);
  });
  it('кристаллы престижа', () => {
    expect(crystalsFor(100, 0)).toBe(94); // 3 · 10^1.5
    expect(crystalsFor(212, 20)).toBe(Math.floor(Math.floor(3 * Math.pow(21.2, 1.5)) * 1.4));
  });
});

describe('кольцо рас', () => {
  it('нежить > эльф > гном > человек > орк > нежить', () => {
    expect(raceMult('undead', 'elf')).toBe(1.5);
    expect(raceMult('elf', 'undead')).toBe(0.7);
    expect(raceMult('orc', 'undead')).toBe(1.5);
    expect(raceMult('undead', 'orc')).toBe(0.7);
    expect(raceMult('undead', 'dwarf')).toBe(1.0);
    expect(raceMult('human', 'human')).toBe(1.0);
  });
  it('раса мобов меняется блоками по 5', () => {
    expect(mobRaceForFloor(1)).toBe('undead');
    expect(mobRaceForFloor(5)).toBe('undead');
    expect(mobRaceForFloor(6)).toBe('elf');
    expect(mobRaceForFloor(26)).toBe('undead');
  });
  it('бонусы отряда', () => {
    expect(partyBonus(['orc', 'orc', 'orc', 'orc', 'orc']).atkMult).toBe(1.15);
    expect(partyBonus(['orc', 'elf', 'dwarf', 'human', 'undead']).creepMult).toBe(1.1);
    expect(partyBonus(['orc', 'elf']).atkMult).toBe(1);
  });
});

describe('оффлайн', () => {
  it('режется лимитом склада и считает добычу', () => {
    const r = computeOffline(10 * 3600 * 1000, 0, 1, 10, 0, 0);
    expect(r.capped).toBe(true);
    expect(r.seconds).toBe(8 * 3600);
    expect(r.gold).toBeCloseTo(floorGold(1) / 10 * 8 * 3600);
  });
});
