import LZString from 'lz-string';
import type { GameState } from '../sim/types';
import { newGameState } from '../sim/party';

const KEY = 'rv-tycoon.save.v1';

/** Миграции: v1 → v2 → ... добавлять сюда. */
const migrations: Record<number, (s: any) => any> = {
  // v1 → v2: артефакты, разовые покупки, забег для престижа, счётчик этажей в отряде
  1: s => ({
    ...s, v: 2,
    runMaxFloor: s.maxFloor ?? 1,
    artifacts: {}, perks: { permGold: false }, dailyFoodDay: '',
    heroes: Object.fromEntries(Object.entries(s.heroes ?? {}).map(([id, h]: [string, any]) => [id, { floorsInParty: 0, ...h }])),
  }),
};

export function serialize(s: GameState): string {
  return LZString.compressToBase64(JSON.stringify({ ...s, savedAt: Date.now() }));
}
export function deserialize(blob: string): GameState {
  let s = JSON.parse(LZString.decompressFromBase64(blob) ?? '{}');
  while (migrations[s.v]) s = migrations[s.v](s);
  return s as GameState;
}
export function saveLocal(s: GameState) {
  try { localStorage.setItem(KEY, serialize(s)); } catch { /* приватный режим */ }
}
export function loadLocal(): GameState {
  try {
    const blob = localStorage.getItem(KEY);
    if (blob) return deserialize(blob);
  } catch { /* битый сейв → новый */ }
  return newGameState();
}
export const exportSave = (s: GameState) => serialize(s);
export const importSave = (blob: string) => deserialize(blob);
