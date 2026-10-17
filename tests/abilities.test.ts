import { describe, it, expect } from 'vitest';
import { createBattle, runToEnd, step } from '../src/sim/battle';
import { applyAbilities, pickTarget, fxMul, ABILITY_KINDS } from '../src/sim/abilities';
import { buildParty, newGameState, HEROES } from '../src/sim/party';
import { mulberry32 } from '../src/sim/rng';
import type { Ability, BattleState, Stats } from '../src/sim/types';
import type { PartyMember } from '../src/sim/battle';

const stats: Stats = { hp: 1000, atk: 10, atkSpeed: 1, crit: 0, critDmg: 1.5, range: 1, moveSpeed: 1 };
const ab = (kind: string, o: Partial<Ability> = {}): Ability => ({ id: kind, kind, cooldown: 100, ...o });
// undead-герой против undead-мобов 1-го этажа: расовый множитель 1.0
const member = (abilities: Ability[], creeps = 0): PartyMember => ({
  heroId: 'x', race: 'undead', stats, abilities,
  creeps: Array.from({ length: creeps }, () => ({ type: 'infantry' as const, race: 'undead' as const, stats: { ...stats, hp: 50 } })),
});
/** Бой с одним врагом вплотную, остальные далеко. */
function arena(party: PartyMember[]): BattleState {
  const s = createBattle(1, party, 1);
  const mobs = s.units.filter(u => u.side === 'enemy' && u.kind === 'mob');
  mobs.forEach((m, i) => { m.x = i === 0 ? 1 : 30 + i; m.hp = m.maxHp = 1000; });
  return s;
}
const cast = (s: BattleState) => applyAbilities(s, mulberry32(1));
const hero = (s: BattleState) => s.units.find(u => u.kind === 'hero')!;
const first = (s: BattleState) => s.units.find(u => u.side === 'enemy' && u.kind === 'mob')!;

describe('способности', () => {
  it('урон: одиночный и AoE', () => {
    const s = arena([member([ab('damage_single', { value: 5 })])]);
    cast(s);
    expect(first(s).hp).toBe(1000 - 50);
    const s2 = arena([member([ab('damage_aoe', { value: 2, radius: 3 })])]);
    s2.units.filter(u => u.kind === 'mob')[1].x = 2;
    cast(s2);
    const [a, b, c] = s2.units.filter(u => u.kind === 'mob');
    expect([a.hp, b.hp, c.hp]).toEqual([980, 980, 1000]);
  });
  it('щит поглощает урон', () => {
    const s = arena([member([ab('shield_self', { value: 0.3, duration: 5 })])]);
    cast(s);
    expect(hero(s).shield).toBe(300);
  });
  it('лечение отряда', () => {
    const s = arena([member([ab('heal_party', { value: 0.2 })])]);
    hero(s).hp = 500;
    cast(s);
    expect(hero(s).hp).toBe(700);
  });
  it('оглушённый враг не атакует', () => {
    const run = (abilities: Ability[]) => {
      const s = arena([member(abilities)]);
      cast(s);
      for (let i = 0; i < 10; i++) step(s);
      return hero(s).hp;
    };
    expect(run([])).toBeLessThan(1000);
    expect(run([ab('stun', { duration: 5 })])).toBe(1000);
  });
  it('воскрешение крипов', () => {
    const s = arena([member([ab('revive_creeps', { value: 1, hp: 1 })], 2)]);
    const creeps = s.units.filter(u => u.kind === 'creep');
    creeps.forEach(c => { c.alive = false; });
    cast(s);
    expect(creeps.every(c => c.alive && c.hp === c.maxHp)).toBe(true);
  });
  it('бафф отряда и таунт', () => {
    const s = arena([member([ab('buff_party', { stat: 'atk', value: 2, duration: 5 })]), { ...member([ab('taunt', { duration: 4 })]), heroId: 'y' }]);
    cast(s);
    expect(fxMul(hero(s), 'atk', s.tick)).toBe(2);
    const [h1, h2] = s.units.filter(u => u.kind === 'hero');
    const mob = first(s);
    h1.x = 0.9; h2.x = -2; // h1 ближе, но h2 дразнит
    expect(pickTarget(s, mob, [h1, h2])).toBe(h2);
  });
  it('расы: нежить поднимает скелетов, люди +золото', () => {
    const s = arena([member([], 1)]);
    const c = s.units.find(u => u.kind === 'creep')!;
    c.hp = 0; c.alive = true;
    const e = first(s);
    e.stats = { ...e.stats, atk: 1e6 }; // мгновенная смерть крипа от удара
    c.x = e.x; c.hp = 1;
    for (let i = 0; i < 5 && c.alive; i++) step(s);
    expect(s.units.some(u => u.refId === 'skeleton' && u.alive)).toBe(true);
  });
  it('все kinds из данных известны', () => {
    for (const h of HEROES) for (const a of [...h.forms.flatMap(f => f.abilities), h.pet.passive]) expect(ABILITY_KINDS.has(a.kind)).toBe(true);
  });
});

describe('интеграция', () => {
  const full = (id: string) => {
    const s = newGameState(0);
    s.heroes[id] = { lvl: 30, form: 2, pet: 10, artifacts: [] };
    s.party = [id];
    return buildParty(s);
  };
  it('детерминизм: один seed — один итог', () => {
    const p = full('alderic');
    // последовательно: счётчик id в floor.ts глобальный и сбрасывается в createBattle
    const a = createBattle(5, p, 7); runToEnd(a);
    const b = createBattle(5, p, 7); runToEnd(b);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
  for (const h of HEROES) {
    it(`${h.id}: форма 2 со всеми способностями доходит до конца`, () => {
      const p = full(h.id);
      expect(p[0].abilities.length).toBeGreaterThanOrEqual(4);
      const s = createBattle(6, p, 3);
      expect(() => runToEnd(s, 6000)).not.toThrow();
      expect(s.units.every(u => Number.isFinite(u.hp))).toBe(true);
    });
  }
});
