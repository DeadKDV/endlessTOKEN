// Человекочитаемые описания способностей: по kind и числам из данных, шаблоны — в i18n (ability.*).
// Смысл зеркалит src/sim/abilities.ts (cast / passive); при изменении механики править оба места.
import ru from '../data/i18n/ru.json';
import en from '../data/i18n/en.json';
import type { Ability } from '../sim/types';

export type Lang = 'ru' | 'en';
const DICT = { ru: ru.ability, en: en.ability };
type Dict = typeof ru.ability;

/** Те же значения по умолчанию, что в sim/abilities.ts (там не экспортируются). shortcut: дубль констант, при смене баланса сверить. */
const DEFAULT_DUR = 5;
const RADIUS: Record<string, number> = { damage_aoe: 2, damage_cone: 3, damage_line: 6, zone_damage: 2, on_kill_aoe: 0 };

const num = (x: number) => String(+x.toFixed(2));
const pct = (x: number) => String(Math.round(x * 100));
const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ''));

/** «+10% атаки», «−30% атаки»; у крита значение прибавляется, у активного щита от hp — отдельная формулировка. */
function statFx(a: Ability, D: Dict, active: boolean): string {
  const v = a.value ?? 1;
  const st = a.stat ?? '';
  const what = (D.stat as Record<string, string>)[st] ?? st;
  if (st === 'crit') return `+${pct(v)}% ${what}`;
  if (st === 'hp' && active && a.kind === 'buff_party') return fill(D.shield, { p: pct(v - 1) });
  return `${v >= 1 ? '+' : '−'}${pct(Math.abs(v - 1))}% ${what}`;
}

export function abilityText(a: Ability, lang: Lang = 'ru'): string {
  const D = DICT[lang];
  const tpl = (D.kind as Record<string, string>)[a.kind];
  if (!tpl) return '';
  const active = (a.cooldown ?? 0) > 0;
  const v = a.value ?? 1;
  const d = a.duration ?? DEFAULT_DUR;
  const cap = a.cap ?? 0;
  const p = {
    v: num(v), p: pct(v), up: pct(v - 1), down: pct(1 - v), d: num(d), r: num(a.radius ?? RADIUS[a.kind] ?? 2),
    x: '×' + num(v), n: a.targets ?? a.count ?? 1, t: pct(a.hpThreshold ?? 0.5), c: pct(a.cost ?? 0), h: pct(a.hp ?? 0.5),
    fx: statFx(a, D, active), dur: active ? fill(D.forDur, { d: num(d) }) : '',
    cap: cap > 0 ? fill(D.capLimit, { n: num(cap), m: pct(v * cap) }) : D.capNone,
  };
  let body = fill(a.kind === 'revive_creeps' && a.count ? D.reviveCount : tpl, p);
  const extra: string[] = [];
  if ((a.hits ?? 1) > 1) extra.push(fill(D.extra.hits, { n: a.hits! }));
  if (a.stun) extra.push(fill(D.extra.stun, { d: num(a.stun) }));
  if (a.root) extra.push(fill(D.extra.root, { d: num(a.root) }));
  if (a.selfHeal) extra.push(fill(D.extra.selfHeal, { p: pct(a.selfHeal) }));
  if (a.critFar) extra.push(D.extra.critFar);
  if (extra.length) body += ', ' + extra.join(', ');
  if (!active) {
    const low = /^[A-ZА-ЯЁ][^A-ZА-ЯЁ]/.test(body) ? body[0].toLowerCase() + body.slice(1) : body;
    return `${D.passive}: ${low}.`;
  }
  return `${body}. ${fill(D.cooldown, { n: num(a.cooldown!) })}.`;
}
