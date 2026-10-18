// Язык интерфейса: выбор хранится в localStorage, без него — по языку браузера. Смена языка перезагружает страницу.
export type Lang = 'ru' | 'en';
export const LANGS: Lang[] = ['ru', 'en'];
const KEY = 'rv-tycoon.lang';

/** Чистый выбор языка: сохранённый, иначе ru* → ru, остальное → en. */
export function pickLang(stored: string | null | undefined, nav: string | null | undefined): Lang {
  if (stored === 'ru' || stored === 'en') return stored;
  return /^ru/i.test(nav ?? '') ? 'ru' : 'en';
}

export function readLang(): Lang {
  let stored: string | null = null;
  try { stored = localStorage.getItem(KEY); } catch { /* приватный режим - по языку браузера */ }
  return pickLang(stored, typeof navigator === 'undefined' ? '' : navigator.language);
}

export function setLang(v: Lang) {
  try { localStorage.setItem(KEY, v); } catch { /* без сохранения выбор не переживёт перезагрузку */ }
  location.reload();
}
