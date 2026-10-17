import { describe, expect, it } from 'vitest';
import { buildGrid, paletteOf, type SpriteSpec } from '../src/render/spriteGrids';

const races = ['undead', 'elf', 'dwarf', 'human', 'orc'] as const;
const roles = ['tank', 'fighter', 'ranger', 'mage', 'support'] as const;
const ctypes = ['infantry', 'ranged', 'healer'] as const;

describe('spriteGrids', () => {
  it('все сетки прямоугольные, а ключи есть в палитре', () => {
    const specs: SpriteSpec[] = [];
    for (const race of races) for (const enemy of [false, true]) {
      for (const role of roles) for (const form of [0, 1, 2]) specs.push({ kind: 'hero', race, enemy, role, form });
      for (const ctype of ctypes) { specs.push({ kind: 'creep', race, enemy, ctype }); specs.push({ kind: 'mob', race, enemy, ctype }); }
      specs.push({ kind: 'boss', race, enemy }, { kind: 'boss', race, enemy, raid: true }, { kind: 'base', race, enemy });
    }
    for (const s of specs) {
      const g = buildGrid(s), pal = paletteOf(s);
      expect(g.every(r => r.length === g[0].length)).toBe(true);
      for (const k of g.flat()) if (k) expect(pal[k], `${s.kind} ${k}`).toBeDefined();
    }
  });
});
