import { describe, it, expect } from 'vitest';
import { newGameState } from '../src/sim/party';
import { floorsToBoss, tabHasPurchase } from '../src/ui/progress';
import { autoAdvanceOn } from '../src/save/autoAdvance';
import { migrate } from '../src/save/storage';

const mk = () => newGameState(0);

describe('прогресс этажа', () => {
  it('до босса: 10-й этаж — 0, 11-й — 9, 1-й — 9', () => {
    expect(floorsToBoss(10)).toBe(0); expect(floorsToBoss(11)).toBe(9); expect(floorsToBoss(1)).toBe(9); expect(floorsToBoss(19)).toBe(1);
  });
  it('авто-проход: по умолчанию включён, false выключает', () => {
    expect(autoAdvanceOn(mk())).toBe(true);
    expect(autoAdvanceOn(migrate(mk()))).toBe(true);
    expect(autoAdvanceOn({ ...mk(), autoAdvance: false })).toBe(false);
  });
});

describe('отметки на вкладках', () => {
  it('Герои: нужно золото на ×1 у героя отряда', () => {
    expect(tabHasPurchase({ ...mk(), gold: '0' }, 'heroes', 0)).toBe(false);
    expect(tabHasPurchase({ ...mk(), gold: '1000' }, 'heroes', 0)).toBe(true);
  });
  it('Деревня/База: очки этажа', () => {
    const s = { ...mk(), floorPoints: 1e6 };
    expect(tabHasPurchase(s, 'village', 0)).toBe(true);
    expect(tabHasPurchase(s, 'base', 0)).toBe(true);
    expect(tabHasPurchase({ ...s, floorPoints: 0 }, 'base', 0)).toBe(false);
  });
  it('Подземелья: нужен портал и свободные входы, в бою отметки нет', () => {
    const s = mk();
    expect(tabHasPurchase(s, 'dungeons', 0)).toBe(false);
    const open = { ...s, base: { portal: 1 } };
    expect(tabHasPurchase(open, 'dungeons', 0)).toBe(true);
    expect(tabHasPurchase(open, 'dungeons', 0, true)).toBe(false);
  });
  it('Магазин: пока не взят стартовый набор', () => {
    expect(tabHasPurchase(mk(), 'shop', 0)).toBe(true);
    expect(tabHasPurchase({ ...mk(), perks: { permGold: false, starterPack: true } }, 'shop', 0)).toBe(false);
  });
});
