import { describe, it, expect } from 'vitest';
import { createBattle, runToEnd, partyDps } from '../src/sim/battle';
import { buildParty, newGameState } from '../src/sim/party';

describe('бой', () => {
  it('детерминирован по seed', () => {
    const s = newGameState(0);
    s.heroes.alderic.lvl = 20;
    const p = buildParty(s);
    const a = runToEnd(createBattle(1, p, 42));
    const b = runToEnd(createBattle(1, p, 42));
    expect(a).toEqual(b);
    const c = runToEnd(createBattle(1, p, 43));
    expect(c.result).toBe(a.result); // исход тот же, тики могут отличаться
  });
  it('герой 20 ур. проходит 1-й этаж, 1 ур. — тоже, но дольше', () => {
    const s = newGameState(0);
    const weak = runToEnd(createBattle(1, buildParty(s), 1));
    s.heroes.alderic.lvl = 20;
    const strong = runToEnd(createBattle(1, buildParty(s), 1));
    expect(weak.result).toBe('win');
    expect(strong.result).toBe('win');
    expect(strong.ticks).toBeLessThan(weak.ticks);
    expect(strong.gold).toBeGreaterThan(0);
  });
  it('герой 1 ур. упирается в стену к 15-му этажу', () => {
    const s = newGameState(0);
    const p = buildParty(s);
    expect(runToEnd(createBattle(15, p, 1)).result).toBe('lose');
  });
  it('partyDps > 0', () => {
    expect(partyDps(buildParty(newGameState(0)))).toBeGreaterThan(0);
  });
});
