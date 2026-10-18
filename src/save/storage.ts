import LZString from 'lz-string';
import type { GameState } from '../sim/types';
import { newGameState } from '../sim/party';
import { newQuests } from '../sim/quests';

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
  // v2 → v3: отметка получения бесплатного стартового набора
  2: s => ({ ...s, v: 3, perks: { permGold: false, ...s.perks, starterPack: false } }),
  // v3 → v4: переключатель авто-прохода этажей («Остаться на этаже»); по умолчанию включён, как раньше
  3: s => ({ ...s, v: 4, autoAdvance: true }),
  // v4 → v5: счётчики статистики, задания дня и ступени достижений (день и задания заполняются при первом событии)
  4: s => ({ ...s, v: 5, quests: newQuests() }),
  // v5 → v6: прогресс обучения; кто уже играл (этаж, второй герой, золото, стартовый набор) — обучение пропущено
  5: s => ({ ...s, v: 6, tutorial: s.maxFloor > 1 || Object.keys(s.heroes ?? {}).length > 1 || Number(s.gold) > 0 || s.perks?.starterPack ? { done: [], skipped: true } : { done: [] } }),
};

export function migrate(s: any): GameState {
  while (migrations[s.v]) s = migrations[s.v](s);
  return s as GameState;
}

export function serialize(s: GameState): string {
  return LZString.compressToBase64(JSON.stringify({ ...s, savedAt: Date.now() }));
}
export function deserialize(blob: string): GameState {
  return migrate(JSON.parse(LZString.decompressFromBase64(blob) ?? '{}'));
}
/** После записи импорта/сброса автосохранение молчит, иначе таймер затрёт новую запись до перезагрузки. */
let frozen = false;

export type ImportResult = { ok: true; state: GameState } | { ok: false; error: 'empty' | 'bad' | 'newer' };

/** Чистая проверка строки импорта: ничего не пишет, битая строка -> ошибка. */
export function parseImport(blob: string): ImportResult {
  const raw = blob.trim();
  if (!raw) return { ok: false, error: 'empty' };
  let o: any;
  try { o = JSON.parse(LZString.decompressFromBase64(raw) || ''); } catch { return { ok: false, error: 'bad' }; }
  if (!o || typeof o !== 'object' || typeof o.v !== 'number') return { ok: false, error: 'bad' };
  if (o.v > Math.max(...Object.keys(migrations).map(Number)) + 1) return { ok: false, error: 'newer' };
  let s: any;
  try { s = migrate(o); } catch { return { ok: false, error: 'bad' }; }
  const ok = typeof s.floor === 'number' && typeof s.savedAt === 'number' && Array.isArray(s.party)
    && s.heroes && typeof s.heroes === 'object' && s.base && typeof s.base === 'object';
  return ok ? { ok: true, state: s as GameState } : { ok: false, error: 'bad' };
}

/** Заменить сейв строкой (импорт) или новой игрой (blob не задан); вызывающий перезагружает страницу. */
export function replaceSave(blob?: string): boolean {
  try {
    localStorage.setItem(KEY, blob ?? serialize(migrate(newGameState())));
    frozen = true;
    return true;
  } catch { return false; }
}

export function saveLocal(s: GameState) {
  if (frozen) return;
  try { localStorage.setItem(KEY, serialize(s)); } catch { /* приватный режим */ }
}
export function loadLocal(): GameState {
  try {
    const blob = localStorage.getItem(KEY);
    if (blob) return deserialize(blob);
  } catch { /* битый сейв → новый */ }
  return migrate(newGameState());
}
export const exportSave = (s: GameState) => serialize(s);
export const importSave = (blob: string) => deserialize(blob);
