import { describe, it, expect } from 'vitest';
import { newGameState } from '../src/sim/party';
import { migrate, serialize, deserialize } from '../src/save/storage';
import { nextTutorialStep, dismissTutorialStep, skipTutorial, TUTORIAL_STEPS } from '../src/ui/tutorial';
import { heroStatView } from '../src/ui/heroStats';
import ru from '../src/data/i18n/ru.json';
import en from '../src/data/i18n/en.json';

const fresh = () => migrate(newGameState(0));
const id = (s: ReturnType<typeof fresh>) => nextTutorialStep(s)?.id;

describe('миграция v5 → v6', () => {
  it('новая игра получает пустой прогресс обучения, v = 6', () => {
    const s = fresh();
    expect(s.v).toBe(7);
    expect(s.tutorial).toEqual({ done: [] });
  });
  it('старый сейв (этаж > 1 / золото / второй герой) обучение пропускает', () => {
    const old = (patch: object) => migrate({ ...newGameState(0), v: 5, quests: undefined, ...patch });
    for (const p of [{ maxFloor: 7 }, { gold: '1200' }, { heroes: { ...newGameState(0).heroes, groul: { lvl: 1, form: 0, pet: 0, artifacts: [], floorsInParty: 0 } } }]) {
      const s = old(p);
      expect(s.v).toBe(7);
      expect(s.tutorial?.skipped).toBe(true);
      expect(nextTutorialStep(s)).toBeUndefined();
    }
  });
  it('переживает сериализацию', () => {
    const s = dismissTutorialStep(fresh(), 'level');
    expect(deserialize(serialize(s)).tutorial).toEqual({ done: ['level'] });
  });
});

describe('подсказки обучения', () => {
  it('первый запуск: «level»; после «Понятно» ждёт условий следующей', () => {
    let s = fresh();
    expect(id(s)).toBe('level');
    s = dismissTutorialStep(s, 'level');
    expect(id(s)).toBeUndefined();
  });
  it('условия: этаж 3 → stay, очки этажа → village, лучший этаж 5 → quests, 10 → pet', () => {
    let s = dismissTutorialStep(fresh(), 'level');
    expect(id({ ...s, floor: 3 })).toBe('stay');
    s = dismissTutorialStep(s, 'stay');
    expect(id({ ...s, floorPoints: 1e6 })).toBe('village');
    expect(id({ ...s, maxFloor: 5 })).toBe('quests');
    expect(id({ ...s, maxFloor: 10 })).toBe('quests');
    expect(id({ ...dismissTutorialStep(s, 'quests'), maxFloor: 10 })).toBe('pet');
  });
  it('воскрешение показывается, когда оно уже даёт кристаллы', () => {
    const s = TUTORIAL_STEPS.slice(0, -1).reduce((x, st) => dismissTutorialStep(x, st.id), fresh());
    expect(id(s)).toBeUndefined();
    expect(id({ ...s, runMaxFloor: 100, maxFloor: 100 })).toBe('prestige');
  });
  it('«Пропустить» гасит всё', () => {
    expect(id(skipTutorial({ ...fresh(), maxFloor: 50, floor: 50 }))).toBeUndefined();
  });
  it('у каждого шага есть текст ru и en', () => {
    for (const st of TUTORIAL_STEPS) {
      expect((ru.tutorial.steps as Record<string, string>)[st.id], st.id).toBeTruthy();
      expect((en.tutorial.steps as Record<string, string>)[st.id], st.id).toBeTruthy();
    }
  });
});

describe('статы в карточке героя', () => {
  it('множитель растёт от формы, петомца и не меньше 1', () => {
    const s = fresh();
    const base = heroStatView(s, 'alderic');
    expect(base.mult.hp).toBeCloseTo(1);
    const up = { ...s, heroes: { alderic: { ...s.heroes.alderic, form: 1 as const, pet: 5 } } };
    const v = heroStatView(up, 'alderic');
    expect(v.mult.hp).toBeGreaterThan(1.8);
    expect(v.stats.hp).toBeGreaterThan(base.stats.hp);
  });
});
