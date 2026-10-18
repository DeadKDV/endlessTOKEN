// Тексты интерфейса: шаблоны из словаря и описания эффектов зданий и артефактов.
import ru from '../data/i18n/ru.json';
import en from '../data/i18n/en.json';
import { readLang } from './lang';
import { goldPerSec, offlineHours } from '../sim/economy';
import type { ArtifactDef } from '../sim/artifacts';
import { artifactValue } from '../sim/artifacts';
import type { BuildingDef } from '../sim/buildings';
import { fmt } from './format';

export const lang = readLang();
export const t: typeof ru = lang === 'en' ? en : ru;
try { document.documentElement.lang = lang; } catch { /* не браузер */ }

/** Название из данных ({ru,en}) на текущем языке. */
export const nm = (n?: { ru: string; en: string }) => (n ? n[lang] : '');

export function tpl(s: string, v: Record<string, string | number> = {}): string {
  return s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ''));
}

const pct = (x: number) => Math.round(x * 100);

/** Описание текущего эффекта здания на уровне level. */
export function buildingEffectText(b: BuildingDef, level: number): string {
  const e = b.effect; const d = t.building as Record<string, string>;
  switch (e.kind) {
    case 'creep_level': return tpl(d.creep_level, { m: Math.pow(e.perLevel, level).toFixed(2) });
    case 'creep_atk': return tpl(d.creep_atk, { p: pct(level * e.perLevel) });
    case 'creep_heal_and_hp': return tpl(d.creep_heal_and_hp, { h: pct(level * e.healPerLevel), p: pct(level * e.infantryHpPerLevel) });
    case 'creep_cap': return tpl(d.creep_cap, { n: Math.floor(level / e.perLevels) * e.add });
    case 'gold_per_sec': return tpl(d.gold_per_sec, { n: fmt(goldPerSec(level)) });
    case 'offline_hours': return tpl(d.offline_hours, { n: offlineHours(level) });
    case 'crystal_bonus': return tpl(d.crystal_bonus, { p: pct(level * e.perLevel) });
    case 'pet_food_per_day': return tpl(d.pet_food_per_day, { n: Math.floor(level / e.perLevels) * e.add });
    case 'unlock_dungeons': return tpl(d.unlock_dungeons, { n: Object.values<number>(e.unlocks).filter(l => level >= l).length });
    default: return '';
  }
}

/** Описание эффекта артефакта; для ненайденного уровня показывает значение 1 ур. */
export function artifactEffectText(a: ArtifactDef, level: number): string {
  const s = (t.dungeonUi.effect as Record<string, string>)[a.effect.kind] ?? a.effect.kind;
  const v = artifactValue(a, Math.max(1, level));
  if (a.effect.kind === 'party_atk_on_creep_death') return tpl(s, { p: Math.round(v) }); // значение - перезарядка, с
  if (a.effect.kind === 'pet_ability_cooldown') return tpl(s, { p: Math.round((1 - v) * 100) });
  return tpl(s, { p: a.effect.kind === 'creep_cap_add' ? Math.floor(v) : pct(v) });
}
