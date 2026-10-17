/**
 * Способности героев и расовые пассивки. Чистая симуляция: только rnd из mulberry32, без Date/Math.random.
 * Всё сводится к трём механизмам: временные эффекты на юнитах (`effects`, until в тиках),
 * общая функция урона `dealDamage` и щит (`shield`).
 */
import economy from '../data/economy.json';
import races from '../data/races.json';
import { raceMult } from './races';
import { floorGold } from './economy';
import { newId } from './floor';
import type { Ability, BattleState, Side, Unit } from './types';

const DT = economy.tickMs / 1000;
const TPS = Math.round(1 / DT);
const WAVES = economy.floor.wavesPerFloor;
const FOREVER = 1e15;
/** Дальше этого расстояния до ближайшего врага активные способности не применяются. shortcut: константа вместо данных. */
const CAST_REACH = 6;
/** Длительность эффекта, если в данных способности duration не указан. */
const DEFAULT_DUR = 5;
const MAX_DEPTH = 3;

export const ABILITY_KINDS = new Set([
  'airborne_party', 'armor_break', 'buff_creeps', 'buff_party', 'buff_self', 'buff_self_conditional', 'crit_all',
  'damage_aoe', 'damage_cone', 'damage_line', 'damage_multi', 'damage_reduction_party', 'damage_screen',
  'damage_single', 'debuff_enemies', 'dodge', 'double_cast', 'execute', 'ghost_creeps', 'heal_creeps', 'heal_party',
  'invuln_creeps', 'invuln_party', 'knockback', 'lifesteal', 'lifesteal_party', 'mark_boss', 'min_hp', 'on_kill_aoe',
  'percent_hp_damage', 'recall_low_hp_creeps', 'reflect', 'reset_on_kill', 'revive_creeps', 'revive_self', 'root',
  'sacrifice_buff', 'shield_party', 'shield_self', 'slow', 'stack_atk', 'stun', 'stun_all', 'summon',
  'taunt', 'teleport_backline', 'time_stop', 'zone_damage',
]);

// ---------- эффекты ----------
const sec = (x: number) => Math.round(x * TPS);
const abOf = (u: Unit, kind: string) => u.abilities?.find(a => a.kind === kind);

export function fxMul(u: Unit, k: string, t: number): number {
  let m = 1;
  if (u.effects) for (const e of u.effects) if (e.k === k && e.until > t) m *= e.v;
  return m;
}
export function fxSum(u: Unit, k: string, t: number): number {
  let m = 0;
  if (u.effects) for (const e of u.effects) if (e.k === k && e.until > t) m += e.v;
  return m;
}
export const fxHas = (u: Unit, k: string, t: number) => !!u.effects?.some(e => e.k === k && e.until > t);

/** Эффект с тем же src обновляется, а не копится. */
function addFx(u: Unit, k: string, v: number, until: number, src?: string) {
  const list = (u.effects ??= []);
  const e = src ? list.find(x => x.src === src && x.k === k) : undefined;
  if (e) { e.v = v; e.until = until; } else list.push({ k, v, until, src });
}

function addShield(u: Unit, amount: number, until: number) {
  u.shield = (u.shield ?? 0) + amount;
  u.shieldUntil = Math.max(u.shieldUntil ?? 0, until);
}

/** stat из данных → пары (эффект, значение). hp обрабатывается отдельно. */
function statEffects(stat: string | undefined, v: number): [string, number][] {
  if (!stat || stat === 'hp') return [];
  if (stat === 'atk_and_speed') return [['atk', v], ['atkSpeed', v]];
  if (stat === 'all') return [['atk', v], ['atkSpeed', v], ['moveSpeed', v]];
  return [[stat, v]];
}

// ---------- производные характеристики ----------
export const isStunned = (u: Unit, t: number) => fxHas(u, 'stun', t);

export function atkOf(u: Unit, t: number): number {
  let m = fxMul(u, 'atk', t);
  for (const a of u.abilities ?? []) {
    if (a.kind !== 'stack_atk') continue;
    const n = a.cap ? Math.min(u.stacks ?? 0, a.cap) : (u.stacks ?? 0);
    m *= 1 + (a.value ?? 0) * n;
  }
  return u.stats.atk * m;
}
export const atkSpeedOf = (u: Unit, t: number) => u.stats.atkSpeed * fxMul(u, 'atkSpeed', t) * fxMul(u, 'slow', t);
export const rangeOf = (u: Unit, t: number) => u.stats.range * fxMul(u, 'range', t);
export function moveSpeedOf(u: Unit, t: number): number {
  if (fxHas(u, 'root', t)) return 0;
  return u.stats.moveSpeed * fxMul(u, 'moveSpeed', t) * fxMul(u, 'slow', t);
}

// ---------- выбор цели ----------
const dist = (a: Unit, b: Unit) => Math.abs(a.x - b.x);
function nearestOf(u: Unit, list: Unit[]): Unit | undefined {
  let best: Unit | undefined; let bd = Infinity;
  for (const f of list) if (f.alive) { const d = dist(u, f); if (d < bd) { bd = d; best = f; } }
  return best;
}

/** Ближайший живой враг; таунт перетягивает, «воздушных» не достают ближние мобы. */
export function pickTarget(s: BattleState, u: Unit, foes: Unit[]): Unit | undefined {
  const t = s.tick;
  let c = foes;
  if (u.side === 'enemy') {
    const taunters = c.filter(f => f.alive && fxHas(f, 'taunt', t));
    if (taunters.length) c = taunters;
    if (u.stats.range <= 1.5) c = c.filter(f => !fxHas(f, 'airborne', t));
  }
  return nearestOf(u, c);
}

// ---------- урон и смерть ----------
interface HitOpts { noReflect?: boolean; depth?: number }

/** Весь урон идёт через неё: неуязвимость, уклонение, щит, min_hp, вампиризм, отражение. Возвращает нанесённое. */
export function dealDamage(s: BattleState, src: Unit | undefined, tgt: Unit, raw: number, rnd: () => number, o: HitOpts = {}): number {
  const t = s.tick;
  if (!tgt.alive || raw <= 0) return 0;
  if (fxHas(tgt, 'invuln', t)) return 0;
  if (tgt.kind === 'base' && !s.baseOpen) return 0;
  if (src && src.stats.range <= 1.5 && fxHas(tgt, 'airborne', t)) return 0;
  if (fxHas(tgt, 'dodge', t)) { const p = fxMul(tgt, 'dodge', t); if (p >= 1 || rnd() < p) return 0; }
  let dmg = raw * fxMul(tgt, 'dmgTaken', t);
  if (tgt.shield) { const ab = Math.min(tgt.shield, dmg); tgt.shield -= ab; dmg -= ab; }
  if (dmg <= 0) return 0;
  if (fxHas(tgt, 'minHp', t)) tgt.hp = Math.max(1, tgt.hp - dmg); else tgt.hp -= dmg;
  if (src) {
    const ls = fxSum(src, 'lifesteal', t);
    if (ls > 0) src.hp = Math.min(src.maxHp, src.hp + dmg * ls);
    const rf = fxSum(tgt, 'reflect', t);
    if (rf > 0 && !o.noReflect && src.alive) dealDamage(s, tgt, src, dmg * rf, rnd, { noReflect: true, depth: o.depth });
  }
  if (tgt.hp <= 0) kill(s, tgt, src, rnd, o.depth ?? 0);
  return dmg;
}

function spawnTemp(s: BattleState, base: Unit, refId: string, hpFrac: number, atkMult: number, ticks: number, dx = 0) {
  const hp = base.maxHp * hpFrac;
  s.units.push({
    id: newId(), side: base.side, race: base.race, kind: 'creep', refId, x: base.x + dx, hp, maxHp: hp,
    stats: { ...base.stats, atk: base.stats.atk * atkMult }, attackCooldown: 0, alive: true,
    temp: true, expireTick: s.tick + ticks,
  });
}

function kill(s: BattleState, v: Unit, killer: Unit | undefined, rnd: () => number, depth: number) {
  const t = s.tick;
  const rv = abOf(v, 'revive_self');
  if (rv && !v.revived) { v.revived = true; v.hp = v.maxHp * (rv.value ?? 1); return; }
  v.alive = false;
  if (v.side === 'enemy') {
    s.goldEarned += floorGold(s.floor) * 0.6 / (economy.floor.mobsPerWave * WAVES) * (s.goldMult ?? 1);
    if (killer && killer.alive && depth < MAX_DEPTH) {
      if (abOf(killer, 'reset_on_kill') && killer.cds) killer.cds.fill(0);
      const ak = abOf(killer, 'on_kill_aoe');
      if (ak) {
        for (const e of s.units) {
          if (e.alive && e.side === v.side && dist(e, v) <= (ak.radius ?? 0)) {
            dealDamage(s, killer, e, atkOf(killer, t) * (ak.value ?? 0) * raceMult(killer.race, e.race), rnd, { depth: depth + 1 });
          }
        }
      }
    }
  } else if (v.kind === 'creep' && !v.temp) {
    if (v.race === 'undead') {
      const p = races.races.undead.passive;
      spawnTemp(s, v, 'skeleton', p.hp, 1, sec(p.duration));
    }
    const g = s.units.find(x => x.alive && x.side === 'party' && fxHas(x, 'ghost', t));
    if (g) {
      const e = g.effects!.find(x => x.k === 'ghost' && x.until > t)!;
      spawnTemp(s, v, 'ghost', 0.5, e.v, e.until - t);
    }
  }
}

/** Обычная атака: крит, execute, stack_atk, пробитие эльфов. */
export function basicAttack(s: BattleState, u: Unit, target: Unit, rnd: () => number) {
  const t = s.tick;
  let dmg = atkOf(u, t) * raceMult(u.race, target.race);
  const ex = abOf(u, 'execute');
  if (ex && target.hp / target.maxHp < (ex.hpThreshold ?? 0.5)) dmg *= ex.value ?? 1;
  const r = rnd();
  const far = fxHas(u, 'critFar', t) && dist(u, target) > 2;
  if (fxHas(u, 'critAll', t) || far || r < u.stats.crit + fxSum(u, 'crit', t)) dmg *= u.stats.critDmg * fxMul(u, 'critDmg', t);
  dealDamage(s, u, target, dmg, rnd);
  if (u.side === 'party' && u.race === 'elf' && u.stats.range > 1.5) {
    const behind = s.units
      .filter(e => e.alive && e.side === 'enemy' && e !== target && dist(u, e) >= dist(u, target))
      .sort((a, b) => dist(u, a) - dist(u, b))
      .slice(0, races.races.elf.passive.pierce);
    for (const e of behind) dealDamage(s, u, e, dmg * raceMult(u.race, e.race) / raceMult(u.race, target.race), rnd);
  }
  if (u.abilities?.some(a => a.kind === 'stack_atk')) u.stacks = (u.stacks ?? 0) + 1;
}

// ---------- инициализация ----------
/** Один раз в createBattle: постоянные бонусы к HP и расовые пассивки, которым не нужен пересчёт каждый тик. */
export function initAbilities(s: BattleState) {
  const party = s.units.filter(u => u.side === 'party');
  for (const h of party) {
    for (const a of h.abilities ?? []) {
      if (a.stat !== 'hp' || (a.cooldown ?? 0) > 0) continue;
      const targets = a.kind === 'buff_party' ? party : a.kind === 'buff_self' ? [h] : [];
      for (const u of targets) { u.maxHp *= a.value ?? 1; u.hp *= a.value ?? 1; }
    }
  }
  const dw = races.races.dwarf.passive;
  const el = races.races.elf.passive;
  for (const u of party) {
    if (u.race === 'dwarf' && u.kind === 'creep') { u.maxHp *= dw.mult; u.hp *= dw.mult; }
    if (u.race === 'elf') addFx(u, 'atkSpeed', el.atkSpeed, FOREVER, 'race:elf');
  }
  if (party.some(u => u.kind === 'hero' && u.race === 'human')) s.goldMult = races.races.human.passive.gold;
}

// ---------- главный тик ----------
const NO_ENEMY_NEEDED = new Set(['heal_party', 'heal_creeps', 'revive_creeps', 'ghost_creeps']);

/** Вызывается из step() каждый тик: срок жизни, ауры, зоны, кулдауны и применение активных способностей. */
export function applyAbilities(s: BattleState, rnd: () => number) {
  const t = s.tick;
  const n = s.units.length;
  const orc = races.races.orc.passive;
  for (let i = 0; i < n; i++) {
    const u = s.units[i];
    if (!u.alive) continue;
    if (u.expireTick !== undefined && t >= u.expireTick) { u.alive = false; continue; }
    if (u.effects?.length) u.effects = u.effects.filter(e => e.until > t);
    if (u.shieldUntil !== undefined && t >= u.shieldUntil) { u.shield = 0; u.shieldUntil = undefined; }
    if (u.side === 'party' && u.race === 'orc' && u.hp / u.maxHp < orc.hpThreshold) addFx(u, 'atk', orc.mult, t + 2, 'race:orc');
  }
  zones(s, rnd);
  for (let i = 0; i < n; i++) {
    const u = s.units[i];
    if (!u.alive || !u.abilities) continue;
    const abs = u.abilities;
    const cds = (u.cds ??= abs.map(() => 0));
    for (let j = 0; j < abs.length; j++) {
      if (cds[j] > 0) cds[j]--;
      const a = abs[j];
      if (!(a.cooldown && a.cooldown > 0)) { passive(s, u, a); continue; }
      if (cds[j] > 0 || isStunned(u, t)) continue;
      if (!cast(s, u, a, rnd)) continue;
      if (u.doubleCast && a.kind !== 'double_cast') { u.doubleCast = false; cast(s, u, a, rnd); }
      cds[j] = Math.ceil(sec(a.cooldown) * fxMul(u, 'cooldown', t));
    }
  }
}

function zones(s: BattleState, rnd: () => number) {
  if (!s.zones?.length) return;
  const t = s.tick;
  s.zones = s.zones.filter(z => z.until > t);
  for (const z of s.zones) {
    if (t < z.next) continue;
    z.next = t + TPS;
    const src = s.units.find(u => u.id === z.src);
    for (const e of s.units) {
      if (e.alive && e.side !== z.side && Math.abs(e.x - z.x) <= z.radius) {
        dealDamage(s, src, e, z.dmg * (src ? raceMult(src.race, e.race) : 1), rnd);
      }
    }
  }
}

/** Постоянные способности: ауры обновляются каждый тик (until = t+2), поэтому действуют и на новых призванных/мобов. */
function passive(s: BattleState, u: Unit, a: Ability) {
  const t = s.tick;
  const v = a.value ?? 1;
  const src = `${u.id}:${a.id}`;
  const side = (x: Side) => s.units.filter(e => e.alive && e.side === x);
  const apply = (targets: Unit[]) => {
    for (const e of targets) for (const [k, val] of statEffects(a.stat, v)) addFx(e, k, val, t + 2, `${src}:${k}`);
  };
  switch (a.kind) {
    case 'buff_self': apply([u]); break;
    case 'buff_party': apply(side(u.side)); break;
    case 'buff_creeps': apply(side(u.side).filter(e => e.kind === 'creep')); break;
    case 'debuff_enemies': apply(side(u.side === 'party' ? 'enemy' : 'party')); break;
    case 'buff_self_conditional':
      if (u.hp / u.maxHp < (a.hpThreshold ?? 0.5)) apply([u]);
      break;
    case 'lifesteal': addFx(u, 'lifesteal', v, t + 2, src); break;
    case 'lifesteal_party': for (const e of side(u.side)) addFx(e, 'lifesteal', v, t + 2, src); break;
    case 'reflect': addFx(u, 'reflect', v, t + 2, src); break;
    case 'recall_low_hp_creeps':
      for (const c of side(u.side)) {
        if (c.kind === 'creep' && !c.recalled && c.hp / c.maxHp < v) {
          c.recalled = true; c.x = u.x; addFx(c, 'invuln', 1, t + sec(2));
        }
      }
      break;
    // execute, stack_atk, on_kill_aoe, reset_on_kill, revive_self читаются на месте (basicAttack / kill)
    default: break;
  }
}

/** Применить активную способность. false — условия не выполнены, кулдаун не тратится. */
function cast(s: BattleState, u: Unit, a: Ability, rnd: () => number): boolean {
  const t = s.tick;
  const mine = s.units.filter(x => x.alive && x.side === u.side && x.kind !== 'base');
  const foes = s.units.filter(x => x.alive && x.side !== u.side && (x.kind !== 'base' || s.baseOpen))
    .sort((p, q) => dist(u, p) - dist(u, q) || p.id - q.id);
  const near = foes[0] as Unit; // для NO_ENEMY_NEEDED может быть undefined, но там не используется
  if (!NO_ENEMY_NEEDED.has(a.kind) && !(foes.length && dist(u, near) <= CAST_REACH)) return false;
  const v = a.value ?? 1;
  const dur = sec(a.duration ?? DEFAULT_DUR);
  const fx = (x: Unit, k: string, val: number, d = dur) => addFx(x, k, val, t + d, `${u.id}:${a.id}:${k}`);
  const dmgMul = (e: Unit, mult: number) => atkOf(u, t) * mult * raceMult(u.race, e.race);
  const hit = (e: Unit, mult: number) => dealDamage(s, u, e, dmgMul(e, mult), rnd);
  const rad = (a.radius ?? 2) * fxMul(u, 'radius', t);
  const dir = foes.length ? (Math.sign(near.x - u.x) || 1) : 1;
  const ahead = (e: Unit, len: number) => { const d = (e.x - u.x) * dir; return d >= -0.01 && d <= len; };
  const extras = (e: Unit) => {
    if (!e.alive) return;
    if (a.stun) fx(e, 'stun', 1, sec(a.stun));
    if (a.root) fx(e, 'root', 1, sec(a.root));
  };
  const buffTargets = (targets: Unit[]) => {
    for (const x of targets) {
      for (const [k, val] of statEffects(a.stat, v)) fx(x, k, val);
      if (a.stat === 'hp') addShield(x, (v - 1) * x.maxHp, t + dur);
      if (a.critFar) fx(x, 'critFar', 1);
    }
  };

  switch (a.kind) {
    case 'damage_single': {
      for (let i = 0; i < (a.hits ?? 1) && near.alive; i++) hit(near, v);
      extras(near);
      return true;
    }
    case 'damage_aoe': {
      const cx = near.x;
      for (let i = 0; i < (a.hits ?? 1); i++) for (const e of foes) if (e.alive && Math.abs(e.x - cx) <= rad) { hit(e, v); extras(e); }
      if (a.selfHeal) u.hp = Math.min(u.maxHp, u.hp + a.selfHeal * u.maxHp);
      return true;
    }
    case 'damage_cone': for (const e of foes) if (e.alive && ahead(e, a.radius ?? 3)) hit(e, v); return true;
    case 'damage_line': for (const e of foes) if (e.alive && ahead(e, a.radius ?? CAST_REACH)) hit(e, v); return true;
    case 'damage_screen': for (const e of foes) hit(e, v); return true;
    case 'damage_multi': {
      const pool = foes.slice();
      for (let i = 0; i < (a.targets ?? 1) && pool.length; i++) hit(pool.splice(Math.floor(rnd() * pool.length), 1)[0], v);
      return true;
    }
    case 'percent_hp_damage':
      for (const e of foes) dealDamage(s, u, e, e.hp * v, rnd);
      return true;
    case 'zone_damage':
      (s.zones ??= []).push({ x: near.x, radius: a.radius ?? 2, dmg: atkOf(u, t) * v, side: u.side, src: u.id, until: t + dur, next: t });
      return true;
    case 'teleport_backline': {
      const far = foes[foes.length - 1];
      u.x = far.x - dir * 0.5;
      hit(far, v);
      return true;
    }
    case 'knockback':
      for (const e of foes) if (e.kind !== 'base' && dist(u, e) <= 3) e.x += Math.sign(e.x - u.x || 1) * v;
      return true;
    case 'slow': for (const e of foes) if (dist(u, e) <= CAST_REACH) fx(e, 'slow', 1 - v); return true;
    case 'stun': for (const e of foes.slice(0, a.targets ?? 1)) fx(e, 'stun', 1); return true;
    case 'root': for (const e of foes.slice(0, a.targets ?? 1)) fx(e, 'root', 1); return true;
    case 'stun_all': case 'time_stop': for (const e of foes) fx(e, 'stun', 1); return true;
    case 'taunt': fx(u, 'taunt', 1); return true;
    case 'armor_break': fx(near, 'dmgTaken', 1 + v); return true;
    case 'mark_boss': {
      const bosses = foes.filter(e => e.kind === 'boss');
      if (!bosses.length) return false;
      for (const e of bosses) fx(e, 'dmgTaken', v);
      return true;
    }
    case 'debuff_enemies':
      for (const e of foes) for (const [k, val] of statEffects(a.stat, v)) fx(e, k, val);
      return true;
    case 'buff_party': buffTargets(mine); return true;
    case 'buff_creeps': buffTargets(mine.filter(x => x.kind === 'creep')); return true;
    case 'buff_self': buffTargets([u]); return true;
    case 'shield_party': for (const x of mine) addShield(x, v * x.maxHp, t + dur); return true;
    case 'shield_self': addShield(u, v * u.maxHp, t + dur); return true;
    case 'heal_party': case 'heal_creeps': {
      const hurt = mine.filter(x => x.hp < x.maxHp && (a.kind === 'heal_party' || x.kind === 'creep'));
      if (!hurt.length) return false;
      for (const x of hurt) x.hp = Math.min(x.maxHp, x.hp + v * x.maxHp);
      return true;
    }
    case 'invuln_party': for (const x of mine) fx(x, 'invuln', 1); return true;
    case 'invuln_creeps': for (const x of mine) if (x.kind === 'creep') fx(x, 'invuln', 1); return true;
    case 'damage_reduction_party': for (const x of mine) fx(x, 'dmgTaken', v); return true;
    case 'airborne_party': for (const x of mine) fx(x, 'airborne', 1); return true;
    case 'dodge': fx(u, 'dodge', v); return true;
    case 'min_hp': fx(u, 'minHp', 1); return true;
    case 'crit_all': for (const x of mine) fx(x, 'critAll', 1); return true;
    case 'double_cast':
      if (!u.abilities!.some(x => x.cooldown && x.kind !== 'double_cast')) return false;
      u.doubleCast = true;
      return true;
    case 'sacrifice_buff': {
      const cost = a.cost ?? 0;
      if (mine.some(x => x.hp / x.maxHp <= cost + 0.05)) return false;
      for (const x of mine) { x.hp -= cost * x.maxHp; fx(x, 'atk', v); }
      return true;
    }
    case 'revive_creeps': {
      const dead = s.units.filter(x => !x.alive && x.side === u.side && x.kind === 'creep' && !x.temp);
      if (!dead.length) return false;
      for (const x of dead.slice(0, a.count ?? Math.ceil(dead.length * v))) {
        x.alive = true; x.hp = x.maxHp * (a.hp ?? 0.5); x.x = u.x;
      }
      return true;
    }
    case 'ghost_creeps':
      fx(u, 'ghost', v);
      for (const x of s.units) if (!x.alive && x.side === u.side && x.kind === 'creep' && !x.temp) spawnTemp(s, x, 'ghost', 0.5, v, dur);
      return true;
    case 'summon':
      for (let i = 0; i < (a.count ?? 2); i++) spawnTemp(s, u, 'summon', 0.3, 0.5, sec(v), -0.3 * (i + 1));
      return true;
    default:
      return false;
  }
}
