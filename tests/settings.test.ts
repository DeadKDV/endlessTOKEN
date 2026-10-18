import { describe, it, expect } from 'vitest';
import LZString from 'lz-string';
import { parseImport, serialize, migrate } from '../src/save/storage';
import { newGameState } from '../src/sim/party';
import { pickLang } from '../src/ui/lang';
import ru from '../src/data/i18n/ru.json';
import en from '../src/data/i18n/en.json';

describe('импорт сейва', () => {
  it('своя строка проходит проверку', () => {
    const r = parseImport(serialize(migrate(newGameState())));
    expect(r.ok).toBe(true);
  });
  it('строка с пробелами по краям проходит', () => {
    expect(parseImport(`  ${serialize(migrate(newGameState()))}\n`).ok).toBe(true);
  });
  it('пустая строка, мусор, не-JSON и чужой объект отклоняются без исключений', () => {
    expect(parseImport('   ')).toEqual({ ok: false, error: 'empty' });
    expect(parseImport('не сейв!!!')).toEqual({ ok: false, error: 'bad' });
    expect(parseImport(LZString.compressToBase64('{не json'))).toEqual({ ok: false, error: 'bad' });
    expect(parseImport(LZString.compressToBase64(JSON.stringify({ a: 1 })))).toEqual({ ok: false, error: 'bad' });
    expect(parseImport(LZString.compressToBase64(JSON.stringify({ v: 6, floor: 'x' })))).toEqual({ ok: false, error: 'bad' });
  });
  it('сейв из будущей версии отклоняется', () => {
    expect(parseImport(LZString.compressToBase64(JSON.stringify({ v: 999 })))).toEqual({ ok: false, error: 'newer' });
  });
  it('проверка ничего не пишет в хранилище', () => {
    const calls: string[] = [];
    (globalThis as any).localStorage = { setItem: (k: string) => calls.push(k), getItem: () => null };
    try { parseImport('мусор'); parseImport(serialize(migrate(newGameState()))); } finally { delete (globalThis as any).localStorage; }
    expect(calls).toEqual([]);
  });
});

describe('язык', () => {
  it('без выбора - по языку браузера: ru* -> ru, остальное -> en', () => {
    expect(pickLang(null, 'ru')).toBe('ru');
    expect(pickLang(null, 'ru-RU')).toBe('ru');
    expect(pickLang(null, 'en-US')).toBe('en');
    expect(pickLang(null, 'de')).toBe('en');
    expect(pickLang(null, undefined)).toBe('en');
  });
  it('сохранённый выбор сильнее языка браузера, мусор игнорируется', () => {
    expect(pickLang('en', 'ru-RU')).toBe('en');
    expect(pickLang('ru', 'en-US')).toBe('ru');
    expect(pickLang('xx', 'ru')).toBe('ru');
  });
  it('в en нет пустых строк в разделе настроек и ключи совпадают с ru', () => {
    expect(Object.keys(en.settings).sort()).toEqual(Object.keys(ru.settings).sort());
    expect(Object.values(en.settings).every(v => typeof v !== 'string' || v.length > 0)).toBe(true);
  });
});
