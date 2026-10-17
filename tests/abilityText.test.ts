import { describe, it, expect } from 'vitest';
import { HEROES } from '../src/sim/party';
import { ABILITY_KINDS } from '../src/sim/abilities';
import type { Ability } from '../src/sim/types';
import { abilityText } from '../src/ui/abilityText';
import ru from '../src/data/i18n/ru.json';
import en from '../src/data/i18n/en.json';

const all = HEROES.flatMap(h => [...h.forms.flatMap(f => f.abilities), h.pet.passive] as unknown as Ability[]);
const byId = (id: string) => all.find(a => a.id === id)!;

describe('описания способностей', () => {
  it('в данных 25 героев и все 48 kinds покрыты шаблонами ru и en', () => {
    expect(HEROES.length).toBe(25);
    for (const k of ABILITY_KINDS) {
      expect((ru.ability.kind as Record<string, string>)[k], k).toBeTruthy();
      expect((en.ability.kind as Record<string, string>)[k], k).toBeTruthy();
    }
  });
  it('каждая способность героев и петомцев даёт непустую чистую строку', () => {
    expect(all.length).toBe(100);
    for (const lang of ['ru', 'en'] as const) for (const a of all) {
      const s = abilityText(a, lang);
      expect(s, a.id).not.toBe('');
      expect(s, `${a.id}: ${s}`).not.toMatch(/undefined|NaN|Infinity|[{}]/);
    }
  });
  it('примеры совпадают с механикой', () => {
    expect(abilityText(byId('the_hunt'))).toBe('Урон ×5 по ближайшему врагу. Перезарядка 12 с.');
    expect(abilityText(byId('anvil_strike'))).toContain('Оглушает ближайших врагов (целей: 1) на 2 с');
    expect(abilityText(byId('ice_grave'))).toContain('оглушение 2 с');
    expect(abilityText(byId('rune_of_stone'))).toBe('Отряд: щит 30% HP на 10 с. Перезарядка 25 с.');
    expect(abilityText(byId('forging'))).toBe('Пассивно: +3% атаки за каждую атаку (до 3 раз, максимум +9%).');
    expect(abilityText(byId('harvest'))).toContain('без предела');
    expect(abilityText(byId('roar'))).toBe('Враги: −30% атаки на 5 с. Перезарядка 18 с.');
    expect(abilityText(byId('rewrite'), 'en')).toBe('The hero\'s next ability fires twice. Cooldown 35s.');
  });
});
