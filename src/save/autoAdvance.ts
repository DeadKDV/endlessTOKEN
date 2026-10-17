// Поле сейва v4 добавлено дополнением типа: src/sim/ в этой правке не меняется.
declare module '../sim/types' {
  interface GameState { autoAdvance?: boolean }
}
import type { GameState } from '../sim/types';

/** Авто-проход этажей включён (по умолчанию да; выкл — отряд фармит текущий этаж). */
export const autoAdvanceOn = (s: GameState) => s.autoAdvance !== false;
