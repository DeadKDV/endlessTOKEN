// Какой набор покадровых атласов рисовать: паки Elthen (public/elthen), прототип из своей копии
// Endless Frontier (public/proto) или только графика кодом. Обе папки в git не лежат - чего нет, то пропускаем.
export type ArtSet = 'elthen' | 'proto' | 'code';
export const ART_SETS: ArtSet[] = ['elthen', 'proto', 'code'];
const KEY = 'rv-tycoon.art';

export function artSet(): ArtSet {
  try {
    const v = localStorage.getItem(KEY) as ArtSet | null;
    if (v && ART_SETS.includes(v)) return v;
  } catch { /* приватный режим - берём по умолчанию */ }
  return 'elthen';
}

/** Смена набора перезагружает страницу: атласы грузятся один раз при старте. */
export function setArtSet(v: ArtSet) {
  try { localStorage.setItem(KEY, v); } catch { /* без сохранения - только до перезагрузки не сработает */ }
  location.reload();
}

/** Папка выбранного набора и список его юнитов; null - набора нет на сервере или выбрана графика кодом. */
let indexP: Promise<{ dir: string; ids: string[] } | null> | undefined;
/** index.json запрашивается один раз. */
export function artIndex() { return indexP ??= fetchIndex(); }

async function fetchIndex(): Promise<{ dir: string; ids: string[] } | null> {
  const set = artSet();
  if (set === 'code') return null;
  const dir = `${import.meta.env.BASE_URL}${set}/`;
  try {
    const r = await fetch(`${dir}index.json`);
    if (!r.ok) return null;
    return { dir, ids: (await r.json()).ids ?? [] };
  } catch {
    return null; // dev-сервер на отсутствующий файл может отдать html
  }
}
