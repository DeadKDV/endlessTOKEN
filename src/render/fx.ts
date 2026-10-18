/**
 * Эффекты боя поверх сцены: касты способностей, статусы, частицы (пул ≤ MAX), монеты, баннеры, тряска.
 * Всё выводится из BattleState между кадрами: скачок cds[i] вверх = каст, shield/effects = статусы, смена объекта состояния = конец боя.
 */
import { Container, Graphics, Sprite, Text, Texture, type Renderer } from 'pixi.js';
import type { BattleState, Unit } from '../sim/types';
import { sfx } from '../audio/sfx';
import { isBossFloor, isRaidBossFloor } from '../sim/floor';
import { isStunned } from '../sim/abilities';
import { t, nm } from '../ui/text';
import economy from '../data/economy.json';

const MAX = 200;
const GOLD = 0xffd54a;
import { GROUND_Y as GROUND } from './layout';
type Cls = 'dmg' | 'cc' | 'heal' | 'buff' | 'shield';
const SELF = new Set(['buff_self', 'buff_self_conditional', 'shield_self', 'dodge', 'double_cast', 'reflect', 'lifesteal', 'stack_atk', 'revive_self', 'sacrifice_buff', 'teleport_backline', 'reset_on_kill', 'min_hp']);
const ALLY = new Set(['buff_party', 'buff_creeps', 'invuln_party', 'invuln_creeps', 'damage_reduction_party', 'lifesteal_party', 'airborne_party', 'ghost_creeps', 'crit_all', 'summon']);
const COLOR: Record<Cls, number> = { dmg: 0xff8844, cc: 0xb070ff, heal: 0x66ff88, buff: GOLD, shield: 0x66ccff };

function classOf(kind: string): Cls {
  if (kind.startsWith('heal_') || kind.startsWith('revive_') || kind === 'recall_low_hp_creeps') return 'heal';
  if (kind.startsWith('shield_')) return 'shield';
  if (SELF.has(kind) || ALLY.has(kind)) return 'buff';
  if (/^(damage|execute|percent|zone|on_kill|knockback)/.test(kind)) return 'dmg';
  return 'cc';
}

interface P { s: Sprite; on: boolean; x: number; y: number; vx: number; vy: number; g: number; age: number; life: number; coin: boolean; x0: number; y0: number }
interface Shape { t: 'ring' | 'flash' | 'streak'; x: number; y: number; r: number; x2: number; born: number; dur: number; color: number }
interface Pos { x: number; y: number; h: number; w: number }

export class BattleFx {
  readonly layer = new Container();
  private g = new Graphics();
  private pool: P[] = [];
  private shapes: Shape[] = [];
  private texts: { t: Text; born: number; y0: number }[] = [];
  private banner: { t: Text; born: number; dur: number } | null = null;
  private cds = new Map<number, number[]>();
  private shakeUntil = 0;
  private shakeAmp = 0;
  private prev: BattleState | null = null;
  private bossShownFloor = 0;
  private winds = new Map<number, { cx: number; r: number; y: number }>(); // активные замахи боссов: где ударит
  private raidG = new Graphics();
  private raidT = new Text({ text: '', style: { fontFamily: 'monospace', fontSize: 18, fontWeight: 'bold', fill: 0xff3333, stroke: { color: 0x000000, width: 4 } } });
  private plus: Texture;
  private coin: Texture;

  constructor(private stage: Container, renderer: Renderer, private pos: (id: number) => Pos | undefined, private coinTo: { x: number; y: number }, private W: number, private H: number, private cell: number) {
    this.plus = renderer.generateTexture(new Graphics().rect(1, 0, 1, 3).rect(0, 1, 3, 1).fill(0xffffff));
    this.coin = renderer.generateTexture(new Graphics().rect(0, 0, 4, 4).fill(0xc99a1e).rect(1, 1, 2, 2).fill(0xfff2a0));
    for (let i = 0; i < MAX; i++) {
      const s = new Sprite(Texture.WHITE);
      s.anchor.set(0.5); s.visible = false;
      this.layer.addChild(s);
      this.pool.push({ s, on: false, x: 0, y: 0, vx: 0, vy: 0, g: 0, age: 0, life: 0, coin: false, x0: 0, y0: 0 });
    }
    this.layer.addChild(this.g);
    this.raidT.anchor.set(0.5, 0);
    this.raidT.position.set(W / 2, 2);
    this.raidG.visible = this.raidT.visible = false;
    stage.addChild(this.raidG, this.raidT);
  }

  shake(amp: number, ms: number, now: number) {
    if (now + ms > this.shakeUntil || amp > this.shakeAmp) { this.shakeUntil = now + ms; this.shakeAmp = amp; }
  }

  private spawn(x: number, y: number, vx: number, vy: number, life: number, color: number, size = 2, g = 60, tex: Texture = Texture.WHITE, coin = false) {
    const p = this.pool.find(q => !q.on);
    if (!p) return;
    Object.assign(p, { on: true, x, y, vx, vy, g, age: 0, life, coin, x0: x, y0: y });
    p.s.texture = tex; p.s.tint = color; p.s.alpha = 1; p.s.visible = true;
    p.s.scale.set(tex === Texture.WHITE ? size : 1);
  }

  private burst(x: number, y: number, color: number, n = 6, speed = 50) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = speed * (0.4 + Math.random() * 0.6);
      this.spawn(x, y, Math.cos(a) * v, Math.sin(a) * v - 15, 0.4 + Math.random() * 0.3, color, 2);
    }
  }

  private shape(t: Shape['t'], x: number, y: number, r: number, color: number, dur: number, now: number, x2 = 0) {
    if (this.shapes.length < 60) this.shapes.push({ t, x, y, r, x2, born: now, dur, color });
  }

  /** Пара монет подпрыгивает у точки смерти и летит к полосе золота. */
  coins(x: number, y: number, n: number) {
    for (let i = 0; i < n; i++) this.spawn(x + (Math.random() - 0.5) * 8, y, (Math.random() - 0.5) * 50, -70 - Math.random() * 40, 1.1, 0xffffff, 1, 260, this.coin, true);
  }

  /** Зелёные «+» над исцелённым. */
  heal(x: number, y: number) {
    this.spawn(x + (Math.random() - 0.5) * 8, y, 0, -22, 0.8, 0x66ff88, 1, 0, this.plus);
  }

  private label(text: string, x: number, y: number, now: number, color = GOLD) {
    const t = new Text({ text, style: { fontFamily: 'monospace', fontSize: 10, fontWeight: 'bold', fill: color, stroke: { color: 0x000000, width: 3 } } });
    t.anchor.set(0.5, 1);
    const off = this.texts.filter(q => now - q.born < 400).length * 11;
    t.position.set(x, y - off);
    this.layer.addChild(t);
    this.texts.push({ t, born: now, y0: y - off });
  }

  private show(text: string, color: number, dur: number, now: number, size = 26) {
    this.banner?.t.destroy();
    const t = new Text({ text, style: { fontFamily: 'monospace', fontSize: size, fontWeight: 'bold', fill: color, stroke: { color: 0x000000, width: 5 }, dropShadow: { color, alpha: 0.7, blur: 8, distance: 0 } } });
    t.anchor.set(0.5);
    t.position.set(this.W / 2, this.H * 0.3);
    t.alpha = 0;
    this.stage.addChild(t);
    this.banner = { t, born: now, dur };
  }

  update(s: BattleState, now: number, isUlt: (u: Unit, i: number) => boolean) {
    if (this.prev !== s) this.newBattle(s, now);
    this.prev = s;
    const alive = s.units.filter(u => u.alive && !u.pending);
    for (const u of alive) {
      const prev = this.cds.get(u.id), cur = u.cds;
      if (cur && prev) for (let i = 0; i < cur.length; i++) if (cur[i] > (prev[i] ?? 0) && u.abilities?.[i]?.cooldown) this.cast(s, u, i, now, isUlt(u, i));
      if (cur) this.cds.set(u.id, cur.slice());
    }
    this.g.clear();
    for (const u of alive) if (u.kind !== 'base') this.status(u, s.tick, now);
    this.bossWindups(s, now);
    this.raidTimer(s, now);
    this.run(now);
    const k = now < this.shakeUntil ? this.shakeAmp * 2 : 0;
    this.stage.position.set((Math.random() - 0.5) * k, (Math.random() - 0.5) * k);
  }

  /** Замах босса: красный круг в точке удара растёт до края зоны; когда замах кончился без срыва - вспышка удара. */
  private bossWindups(s: BattleState, now: number) {
    const seen = new Set<number>();
    for (const u of s.units) {
      if (!u.alive || u.kind !== 'boss') continue;
      const e = u.effects?.find(x => x.k === 'windup' && x.until > s.tick);
      const a = u.abilities?.find(x => x.kind === 'boss_slam');
      const p = this.pos(u.id);
      if (!e || !a || !p) continue;
      seen.add(u.id);
      const r = (a.radius ?? 2) * this.cell, x = e.v * this.cell;
      const k = Math.min(1, 1 - (e.until - s.tick) / ((a.windup ?? 0.6) * 1000 / economy.tickMs));
      this.winds.set(u.id, { cx: x, r, y: p.y });
      this.g.ellipse(x, p.y - 2, r, r * 0.28).fill({ color: 0xff2222, alpha: 0.12 + 0.12 * Math.sin(now / 70) }).stroke({ color: 0xff5555, width: 1.5, alpha: 0.9 });
      this.g.ellipse(x, p.y - 2, r * k, r * 0.28 * k).fill({ color: 0xff2222, alpha: 0.2 + 0.4 * k });
    }
    for (const [id, w] of this.winds) {
      if (seen.has(id)) continue;
      this.winds.delete(id);
      const u = s.units.find(q => q.id === id);
      if (!u?.alive || isStunned(u, s.tick)) continue; // босс убит или оглушён - удара нет
      this.shape('flash', w.cx, w.y - 6, w.r, 0xff4422, 350, now);
      this.shape('ring', w.cx, w.y - 4, w.r, 0xffaa66, 450, now);
      this.burst(w.cx, w.y - 4, 0xff6633, 12, 70);
      this.shake(5, 300, now);
      sfx('ult');
    }
  }

  /** Таймер рейд-босса: крупные цифры и полоса сверху; в последние 10 с мигают. */
  private raidTimer(s: BattleState, now: number) {
    const left = s.raidUntil !== undefined && !s.finished ? (s.raidUntil - s.tick) * economy.tickMs / 1000 : 0;
    const on = left > 0;
    this.raidG.visible = this.raidT.visible = on;
    if (!on) return;
    const sec = Math.ceil(left), warn = left <= 10;
    this.raidT.text = `${t.battleHud.raid} ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
    this.raidT.alpha = this.raidG.alpha = warn && Math.floor(now / 250) % 2 ? 0.3 : 1;
    const w = 160, x = this.W / 2 - w / 2;
    this.raidG.clear().rect(x, 24, w, 5).fill(0x222222).rect(x, 24, w * Math.min(1, left / economy.floor.raidBossTimerSec), 5).fill(warn ? 0xff2222 : 0xcc4444);
  }

  /** Объект состояния сменился: предыдущий бой кончился (finished остаётся на старом объекте, game.ts сразу создаёт новый). */
  private newBattle(s: BattleState, now: number) {
    const p = this.prev;
    this.cds.clear();
    if (!p || p.waveGen || s.waveGen) return;
    if (p.finished === 'win') { this.show(t.battleHud.floorClear, GOLD, 1200, now); sfx('win'); }
    else if (p.finished === 'lose') { this.show(t.battleHud.baseFell, 0xff4444, 1400, now); sfx('lose'); }
    if (s.floor === p.floor && !p.finished) return; // перезапуск того же этажа (прокачка) - без предупреждений
    if (s.floor !== this.bossShownFloor && (isBossFloor(s.floor) || isRaidBossFloor(s.floor))) {
      this.bossShownFloor = s.floor;
      const raid = isRaidBossFloor(s.floor);
      setTimeout(() => this.show(raid ? t.battleHud.raid : t.battleHud.bossBanner, 0xff3333, 1300, performance.now(), 34), p.finished === 'win' ? 1200 : 0);
    } else if (!isBossFloor(s.floor)) this.bossShownFloor = 0;
  }

  private cast(s: BattleState, u: Unit, i: number, now: number, ult: boolean) {
    const a = u.abilities![i], cls = classOf(a.kind), c = COLOR[cls];
    const me = this.pos(u.id);
    if (!me) return;
    const cy = me.y - me.h * 0.5;
    sfx(ult ? 'ult' : 'cast');
    this.label(nm(a.name) || a.id, me.x, me.y - me.h - 16, now, ult ? 0xffffff : GOLD);
    this.shape('flash', me.x, cy, me.h * 0.9, c, 350, now);
    this.burst(me.x, cy, c, 6, 40);
    if (u.kind === 'boss') { // приёмы босса: замах рисует bossWindups, рёв и зов - здесь
      if (a.kind === 'boss_slam') return;
      this.shape('ring', me.x, cy, a.kind === 'stun_all' ? 150 : 50, a.kind === 'stun_all' ? 0xffd0a0 : 0x9955cc, 600, now);
      if (a.kind === 'stun_all') this.shake(6, 400, now);
      if (a.kind === 'boss_summon') { this.burst(me.x - 15, cy, 0x9955cc, 10, 40); return; }
    }
    if (ult) { this.shake(4, 350, now); this.shape('ring', me.x, cy, 60, 0xffffff, 450, now); }
    const side = (same: boolean) => s.units.filter(o => o.alive && !o.pending && o.kind !== 'base' && (o.side === u.side) === same);
    if (cls === 'heal' || cls === 'buff' || cls === 'shield') {
      const ts = SELF.has(a.kind) ? [u] : side(true);
      for (const t of ts.slice(0, 12)) {
        const p = this.pos(t.id);
        if (!p) continue;
        if (cls === 'heal') { this.heal(p.x, p.y - p.h * 0.5); this.heal(p.x, p.y - p.h * 0.7); }
        else if (cls === 'buff') { this.burst(p.x, p.y - p.h * 0.3, GOLD, 3, 18); this.shape('flash', p.x, p.y - p.h * 0.5, p.h * 0.7, GOLD, 500, now); }
        else this.shape('ring', p.x, p.y - p.h * 0.5, p.h * 0.8, c, 350, now);
      }
      return;
    }
    const foes = side(false).sort((x, y) => Math.abs(x.x - u.x) - Math.abs(y.x - u.x));
    const near = foes[0];
    const np = near && this.pos(near.id);
    if (!near || !np) return;
    const hit = (t: Unit) => {
      const p = this.pos(t.id);
      if (p) { this.burst(p.x, p.y - p.h * 0.5, c, 5, 45); this.shape('flash', p.x, p.y - p.h * 0.5, p.h * 0.8, c, 300, now); }
    };
    const k = a.kind;
    if (k === 'damage_screen' || k === 'stun_all' || k === 'time_stop') foes.slice(0, 14).forEach(hit);
    else if (k === 'damage_line' || k === 'damage_cone' || k === 'knockback') {
      const dir = np.x >= me.x ? 1 : -1;
      this.shape('streak', me.x, cy, 4, c, 350, now, me.x + dir * 90);
      foes.filter(t => (t.x - u.x) * dir >= 0 && Math.abs(t.x - u.x) < 6).slice(0, 8).forEach(hit);
    } else if (k === 'damage_aoe' || k === 'zone_damage' || k === 'on_kill_aoe' || k === 'debuff_enemies') {
      const r = a.radius ?? 2;
      this.shape('ring', np.x, np.y - 6, r * this.cell, c, 450, now);
      foes.filter(t => Math.abs(t.x - near.x) <= r).slice(0, 8).forEach(hit);
    } else foes.slice(0, Math.max(1, a.targets ?? 1)).forEach(hit);
  }

  /** Пока висит эффект: щит - пузырь, стан - искры над головой, корни - линии у ног, замедление - синее пятно. */
  private status(u: Unit, tick: number, now: number) {
    const p = this.pos(u.id);
    if (!p) return;
    const g = this.g, cy = p.y - p.h * 0.5;
    if ((u.shield ?? 0) > 0) g.ellipse(p.x, cy, p.w * 0.9 + 3, p.h * 0.62).fill({ color: 0x66ccff, alpha: 0.18 }).stroke({ color: 0xaaeeff, width: 1, alpha: 0.6 });
    for (const e of u.effects ?? []) {
      if (e.until <= tick) continue;
      if (e.k === 'invuln') g.ellipse(p.x, cy, p.w * 0.9 + 3, p.h * 0.62).fill({ color: GOLD, alpha: 0.2 }).stroke({ color: 0xfff2a0, width: 1, alpha: 0.7 });
      else if (e.k === 'atk' && e.src?.includes(':boss_enrage:')) g.ellipse(p.x, cy, p.w * 0.9 + 4, p.h * 0.62 + 2).fill({ color: 0xff2222, alpha: 0.14 + 0.1 * Math.sin(now / 120) }).stroke({ color: 0xff4444, width: 1, alpha: 0.7 });
      else if (e.k === 'stun') for (let k = 0; k < 3; k++) { const a = now / 180 + k * 2.1; g.rect(p.x + Math.cos(a) * 6 - 1, p.y - p.h - 3 + Math.sin(a) * 2 - 1, 3, 3).fill(0xffee44); }
      else if (e.k === 'root') for (let k = -1; k <= 1; k++) g.moveTo(p.x + k * 4, p.y + 1).lineTo(p.x + k * 5 + 1, p.y - 5).stroke({ color: 0x55aa33, width: 1.5 });
      else if (e.k === 'slow') g.ellipse(p.x, p.y, p.w * 0.7, 3).fill({ color: 0x4488ff, alpha: 0.5 });
    }
  }

  private run(now: number) {
    const g = this.g, dt = 1 / 60;
    for (const p of this.pool) {
      if (!p.on) continue;
      p.age += dt;
      if (p.age >= p.life) { p.on = false; p.s.visible = false; continue; }
      if (p.coin && p.age > 0.45) { // подпрыгнула - летит к полосе золота
        if (p.age - dt <= 0.45) { p.x0 = p.x; p.y0 = p.y; }
        const k = Math.min(1, (p.age - 0.45) / (p.life - 0.45)), e = k * k;
        p.x = p.x0 + (this.coinTo.x - p.x0) * e;
        p.y = p.y0 + (this.coinTo.y - p.y0) * e;
      } else {
        p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.coin && p.y > GROUND && p.vy > 0) { p.y = GROUND; p.vy *= -0.4; }
        if (!p.coin) p.s.alpha = 1 - p.age / p.life;
      }
      p.s.position.set(p.x, p.y);
    }
    this.shapes = this.shapes.filter(s => {
      const k = (now - s.born) / s.dur;
      if (k >= 1) return false;
      if (s.t === 'ring') g.circle(s.x, s.y, s.r * (0.3 + 0.7 * k)).stroke({ color: s.color, width: 2, alpha: 1 - k });
      else if (s.t === 'flash') g.circle(s.x, s.y, s.r * (0.6 + 0.6 * k)).fill({ color: s.color, alpha: 0.5 * (1 - k) });
      else g.rect(Math.min(s.x, s.x2), s.y - s.r * (1 - k), Math.abs(s.x2 - s.x), s.r * 2 * (1 - k)).fill({ color: s.color, alpha: 0.7 * (1 - k) });
      return true;
    });
    this.texts = this.texts.filter(q => {
      const age = now - q.born;
      if (age >= 1000) { q.t.destroy(); return false; }
      q.t.y = q.y0 - age * 0.02;
      q.t.alpha = Math.min(1, 2.5 - age / 400);
      return true;
    });
    const b = this.banner;
    if (b) {
      const k = (now - b.born) / b.dur;
      if (k >= 1) { b.t.destroy(); this.banner = null; }
      else { b.t.alpha = k < 0.15 ? k / 0.15 : k > 0.7 ? (1 - k) / 0.3 : 1; b.t.scale.set(1 + 0.25 * Math.max(0, 1 - k * 5) + 0.04 * Math.sin(now / 90)); }
    }
  }
}
