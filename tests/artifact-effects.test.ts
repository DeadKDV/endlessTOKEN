import { describe, it, expect } from 'vitest';
import { createBattle, step } from '../src/sim/battle';
import { buildParty, newGameState, heroById } from '../src/sim/party';
import { dealDamage } from '../src/sim/abilities';
import { mulberry32 } from '../src/sim/rng';

function withArtifact(id: string, level: number, pet = 0, form: 0 | 1 | 2 = 0) {
  const s = newGameState(0);
  s.heroes.alderic = { lvl: 150, form, pet, artifacts: [id], floorsInParty: 0 };
  s.artifacts = { [id]: level };
  return s;
}

describe('артефакты, которые раньше не действовали', () => {
  it('Сердце мёртвого короля: гибель крипа - отряду ×1.5 атаки, потом перезарядка', () => {
    const b = createBattle(1, buildParty(withArtifact('dead_king_heart', 1)), 1);
    for (const u of b.units) if (u.pending) { u.alive = true; u.pending = false; u.spawnAt = undefined; }
    const hero = b.units.find(u => u.kind === 'hero')!;
    const creeps = b.units.filter(u => u.side === 'party' && u.kind === 'creep');
    dealDamage(b, undefined, creeps[0], 1e12, mulberry32(1));
    expect(hero.effects?.some(e => e.k === 'atk' && e.v === 1.5 && e.src === 'art:dead_king_heart')).toBe(true);
    const i = hero.abilities!.findIndex(a => a.kind === 'rally_on_creep_death');
    expect(hero.cds![i]).toBe(300); // 30 с на 1 уровне
    hero.effects = [];
    dealDamage(b, undefined, creeps[1], 1e12, mulberry32(1));
    expect(hero.effects.length).toBe(0); // на перезарядке - второй раз не срабатывает
    step(b); // и бой с этой способностью идёт без ошибок
  });
  it('Тотем духов укорачивает перезарядку способностей петомца', () => {
    const pas = heroById('alderic')!.pet.passive as { cooldown?: number };
    const plain = buildParty(withArtifact('spirit_totem', 0, 10, 2))[0].abilities;
    const fast = buildParty(withArtifact('spirit_totem', 50, 10, 2))[0].abilities;
    const cd = (list: typeof plain, i: number) => list[i].cooldown ?? 0;
    const petIdx = plain.findIndex(a => a.id === (pas as { id?: string }).id);
    if ((pas.cooldown ?? 0) > 0) expect(cd(fast, petIdx)).toBeCloseTo(cd(plain, petIdx) * 0.5);
    const unionIdx = plain.length - (pas ? 2 : 1); // способность формы «Союз» - перед пассивкой петомца
    expect(cd(fast, unionIdx)).toBeCloseTo(cd(plain, unionIdx) * 0.5);
  });
});
