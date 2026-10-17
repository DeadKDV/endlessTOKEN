// Обучение новичка: цепочка подсказок-облачков. Чистая логика — показ по состоянию сейва; прогресс хранится в сейве (tutorial).
import type { GameState } from '../sim/types';
import { prestigeGain } from '../sim/prestige';
import { tabHasPurchase } from './progress';

// Поле сейва v6 добавлено дополнением типа (как autoAdvance): src/sim/ не меняется.
declare module '../sim/types' {
  interface GameState { tutorial?: TutorialSave }
}
export interface TutorialSave { done: string[]; skipped?: boolean }

export interface TutorialStep {
  id: string;
  /** Значения data-tut элементов, к которым привязано облачко; берётся первый найденный на экране. */
  anchors: string[];
  when: (s: GameState) => boolean;
}

/** Порядок показа: первая ещё не закрытая подсказка, чьё условие выполнено. */
export const TUTORIAL_STEPS: TutorialStep[] = [
  { id: 'level', anchors: ['quick', 'nav-battle'], when: () => true },
  { id: 'stay', anchors: ['stay'], when: s => s.floor >= 3 },
  { id: 'village', anchors: ['nav-village'], when: s => tabHasPurchase(s, 'village', 0) },
  { id: 'quests', anchors: ['quests'], when: s => s.maxFloor >= 5 },
  { id: 'pet', anchors: ['nav-heroes'], when: s => s.maxFloor >= 10 },
  { id: 'prestige', anchors: ['prestige', 'nav-battle'], when: s => prestigeGain(s) >= 1 },
];

export function nextTutorialStep(s: GameState): TutorialStep | undefined {
  if (s.tutorial?.skipped) return undefined;
  const done = s.tutorial?.done ?? [];
  return TUTORIAL_STEPS.find(st => !done.includes(st.id) && st.when(s));
}

export const dismissTutorialStep = (s: GameState, id: string): GameState =>
  ({ ...s, tutorial: { ...s.tutorial, done: [...(s.tutorial?.done ?? []), id] } });

export const skipTutorial = (s: GameState): GameState =>
  ({ ...s, tutorial: { done: s.tutorial?.done ?? [], skipped: true } });
