/**
 * PixiJS-сцена боя. Логическое разрешение 360×640, масштаб пиксельный (CSS в index.html).
 * Камера неподвижна: поле от тылов отряда (x=-3) до вражеской базы (BASE_X) целиком на экране, земля на y=420.
 * Кадр юнита берётся из атласа public/atlases/<раса> (см. scripts/pack-atlas.mjs) по basename поля sprite;
 * без атласа — процедурный спрайт (procSprites), прямоугольник цвета расы — лишь крайний фоллбек.
 * Высший приоритет — покадровые атласы public/proto (index.json со списком id): нет файла — слой молча отключён.
 */
import { AnimatedSprite, Application, Assets, Container, Graphics, Sprite, Spritesheet, Text, Texture } from 'pixi.js';
import { get } from 'svelte/store';
import type { BattleState, CreepType, Role, Unit } from '../sim/types';
import { BASE_X } from '../sim/battle';
import { save } from '../game';
import { procSprite, type ProcTex } from './procSprites';
import { Backdrop } from './backdrop';
import races from '../data/races.json';
import creeps from '../data/creeps.json';
import economy from '../data/economy.json';

type HeroDef = { id: string; role: Role; forms: { sprite?: string }[] };

export const LOGICAL_W = 360;
export const LOGICAL_H = 640;
const FIELD_L = -3;                             // тылы отряда
const FIELD_R = BASE_X + 1;                     // база прижата к правому краю
const CELL = LOGICAL_W / (FIELD_R - FIELD_L);   // пикселей на клетку: поле целиком на экране
const GROUND_Y = 420;      // линия земли в логических пикселях
const WAVES = economy.floor.wavesPerFloor;
const POPUP_MS = 800;
const PROTO_H: Record<Unit['kind'], number> = { hero: 56, creep: 36, mob: 36, boss: 84, base: 96 }; // рост прото-юнита, px
const PROJ_SPEED = 14;     // клеток/с
const ATTACK_MS = 420, HURT_MS = 250, DEATH_MS = 700;

const HEROES = new Map<string, HeroDef>(
  Object.values(import.meta.glob<{ default: HeroDef[] }>('../data/heroes/*.json', { eager: true }))
    .flatMap(m => m.default).map(h => [h.id, h]),
);
const CREEP_SPRITE = new Map<string, string>(
  (creeps.creeps as { id: string; sprite?: string }[]).filter(c => c.sprite).map(c => [c.id, c.sprite!]),
);
const CREEP_TYPE = new Map<string, CreepType>(
  (creeps.creeps as { id: string; type: CreepType }[]).map(c => [c.id, c.type]),
);
const FADE_MS = 300, FLASH_MS = 110, LUNGE_MS = 160;
const TEXT_SMALL = { fontFamily: 'monospace', fontSize: 10, fill: 0xffffff };

interface Proto { sheet: Spritesheet; anchors: Record<string, [number, number]>; charH: Record<string, number> }
interface UnitView {
  root: Container; hp: Graphics; w: number; h: number;
  sprite: Sprite; tex?: ProcTex;
  lastX: number; lastCd: number; lunge: number; flash: number; moving: number;
  proto?: Proto; anim?: AnimatedSprite; form: number; cur: string; action: string; actionUntil: number; hurtAt: number;
}
interface Proj {
  g: Graphics; x0: number; y0: number; x1: number; y1: number; born: number; dur: number; arc: number;
  target: Unit; dmg: number; pu?: Unit;
}
interface Popup { t: Text; born: number; y0: number }
interface Row { c: Container; g: Graphics; t: Text }

export class BattleView {
  app = new Application();
  world = new Container();
  private views = new Map<number, UnitView>();
  private dying: { v: UnitView; born: number }[] = [];
  private backdrop = new Backdrop(GROUND_Y, LOGICAL_H);
  private lastHp = new Map<number, number>();
  private sheets = new Map<string, Spritesheet>();
  private protos = new Map<string, Proto>();
  private projs: Proj[] = [];
  private popups: Popup[] = [];
  private bossRow = makeRow();
  private baseRow = makeRow();
  private floorLabel = new Text({ text: '', style: { fontFamily: 'monospace', fontSize: 11, fill: 0xffffff } });

  async init(host: HTMLElement) {
    await this.app.init({ width: LOGICAL_W, height: LOGICAL_H, background: '#0b0b12', antialias: false, resolution: 1 });
    this.app.canvas.style.width = '100%';
    this.app.canvas.style.height = '100%';
    host.appendChild(this.app.canvas);
    this.bossRow.c.position.set(0, 42);
    this.baseRow.c.position.set(0, 62);
    this.floorLabel.position.set(8, GROUND_Y + 4);
    this.world.x = -FIELD_L * CELL;
    this.app.stage.addChild(this.backdrop, this.world, this.bossRow.c, this.baseRow.c, this.floorLabel);
    await this.loadAtlases();
    await this.loadProtos();
  }

  render(s: BattleState) {
    const now = performance.now();
    this.backdrop.scroll(0);
    const byId = new Map(s.units.map(u => [u.id, u]));
    for (const u of s.units) {
      if (!u.alive) continue;
      const v = this.views.get(u.id) ?? this.makeView(u);
      if (u.attackCooldown > v.lastCd + 1e-6) this.onAttack(v, u, s, now);
      v.lastCd = u.attackCooldown;
    }

    const seen = new Set<number>();
    const hp = new Map<number, number>();
    for (const u of s.units) {
      const prev = this.lastHp.get(u.id);
      if (prev !== undefined && u.hp < prev) this.popup(u, prev - u.hp, now);
      hp.set(u.id, u.hp);
      if (!u.alive) continue;
      seen.add(u.id);
      const v = this.views.get(u.id)!;
      if (prev !== undefined && u.hp < prev) { v.flash = now + FLASH_MS; v.hurtAt = now; this.act(v, 'hurt', HURT_MS, now); }
      this.animate(v, u, now);
      const px = u.x * CELL;
      // база не вылезает за правый край экрана
      v.root.position.set(u.kind === 'base' ? Math.min(px, LOGICAL_W - 2 + FIELD_L * CELL - v.sprite.width / 2) : px, GROUND_Y);
      drawHp(v.hp, u, v.w, v.h);
    }
    this.lastHp = hp;
    for (const [id, v] of this.views) if (!seen.has(id)) {
      if (v.anim) this.setAnim(v, 'death', false, DEATH_MS);
      this.dying.push({ v, born: now }); this.views.delete(id);
    }
    this.dying = this.dying.filter(d => {
      const a = 1 - (now - d.born - (d.v.anim ? DEATH_MS : 0)) / FADE_MS;
      if (a <= 0) { d.v.root.destroy({ children: true }); return false; }
      d.v.root.alpha = Math.min(1, a);
      return true;
    });

    this.updateProjs(now, byId);
    this.updatePopups(now);
    drawBig(this.bossRow, s, 'boss', 'Босс');
    drawBig(this.baseRow, s, 'base', 'База');
    this.floorLabel.text = `Этаж ${s.floor} · волна ${s.wave}/${WAVES}`;
  }

  private async loadAtlases() {
    const base = import.meta.env.BASE_URL;
    let list: string[] = [];
    try {
      list = (await (await fetch(`${base}atlases/index.json`)).json()).races ?? [];
    } catch {
      return; // index.json не собран — рисуем прямоугольники
    }
    await Promise.all(list.map(async race => {
      try {
        const texture = await Assets.load<Texture>(`${base}atlases/${race}.png`);
        const data = await (await fetch(`${base}atlases/${race}.json`)).json();
        const sheet = new Spritesheet(texture, data);
        await sheet.parse();
        this.sheets.set(race, sheet);
      } catch (e) {
        console.warn(`атлас ${race} не загружен`, e);
      }
    }));
  }

  private async loadProtos() {
    const base = import.meta.env.BASE_URL;
    let ids: string[];
    try {
      const r = await fetch(`${base}proto/index.json`);
      if (!r.ok) return;
      ids = (await r.json()).ids ?? [];
    } catch {
      return; // слоя нет (404, а dev-сервер может отдать html) — молча пропускаем
    }
    await Promise.all(ids.map(async id => {
      try {
        const texture = await Assets.load<Texture>(`${base}proto/${id}.png`);
        texture.source.scaleMode = 'nearest';
        const data = await (await fetch(`${base}proto/${id}.json`)).json();
        const sheet = new Spritesheet(texture, data);
        await sheet.parse();
        this.protos.set(id, { sheet, anchors: data.meta.anchors, charH: data.meta.charH });
      } catch (e) {
        console.warn(`прото-атлас ${id} не загружен`, e);
      }
    }));
  }

  private protoOf(u: Unit): Proto | undefined {
    return this.protos.get(u.kind === 'hero' || u.kind === 'creep' ? u.refId : `${u.race}_${u.refId}`);
  }

  private setAnim(v: UnitView, name: string, loop: boolean, durMs?: number) {
    const a = v.anim, p = v.proto;
    if (!a || !p) return;
    const key = p.sheet.animations[`f${v.form}_${name}`] ? `f${v.form}_${name}` : `f0_${name}`;
    if (v.cur === key && loop) return;
    v.cur = key;
    const frames = p.sheet.animations[key];
    a.loop = loop;
    a.textures = frames;
    a.animationSpeed = (durMs ? frames.length / (durMs / 1000) : name === 'walk' ? 10 : 5) / 60;
    a.gotoAndPlay(0);
  }

  /** Разовое действие (атака/урон): играет durMs, затем возврат к idle/walk. Атака важнее урона. */
  private act(v: UnitView, name: string, durMs: number, now: number) {
    if (!v.anim || (name === 'hurt' && v.action === 'attack' && now < v.actionUntil)) return;
    v.action = name; v.actionUntil = now + durMs;
    this.setAnim(v, name, false, durMs);
  }

  private onAttack(v: UnitView, u: Unit, s: BattleState, now: number) {
    v.lunge = now;
    this.act(v, 'attack', ATTACK_MS, now);
    if (u.stats.range <= 1.5 || u.kind === 'base') return;
    const heals = (u.healPower ?? 0) > 0 || CREEP_TYPE.get(u.refId) === 'healer';
    const cands = s.units.filter(o => o.alive && o.id !== u.id && (heals ? o.side === u.side : o.side !== u.side));
    if (!cands.length) return;
    const t = heals
      ? cands.reduce((a, b) => (b.hp / b.maxHp < a.hp / a.maxHp ? b : a))
      : cands.reduce((a, b) => (Math.abs(b.x - u.x) < Math.abs(a.x - u.x) ? b : a));
    const arrow = !heals && (u.kind === 'creep' ? CREEP_TYPE.get(u.refId) === 'ranged' : HEROES.get(u.refId)?.role === 'ranger');
    const g = new Graphics();
    if (arrow) {
      g.moveTo(-9, 0).lineTo(3, 0).stroke({ color: 0xd7ccc8, width: 1.5 });
      g.poly([3, -2.5, 8, 0, 3, 2.5]).fill(0xeceff1);
      g.poly([-9, 0, -11, -2, -7, 0, -11, 2]).fill(0xc0392b);
    } else {
      const c = heals ? 0x66ff88 : orbColor(u.race);
      g.circle(0, 0, 6).fill({ color: c, alpha: 0.3 }).circle(0, 0, 3.2).fill(c).circle(-0.8, -0.8, 1.2).fill(0xffffff);
    }
    this.world.addChild(g);
    const dir = t.x >= u.x ? 1 : -1;
    const x0 = u.x * CELL + dir * 6, y0 = GROUND_Y - v.h * 0.6;
    const x1 = t.x * CELL, y1 = GROUND_Y - (this.views.get(t.id)?.h ?? 20) * 0.55;
    const dist = Math.hypot(x1 - x0, y1 - y0);
    this.projs.push({ g, x0, y0, x1, y1, born: now, dur: Math.max(90, dist / (PROJ_SPEED * CELL) * 1000), arc: arrow ? 12 : 3, target: t, dmg: 0 });
  }

  private updateProjs(now: number, byId: Map<number, Unit>) {
    this.projs = this.projs.filter(p => {
      const t = Math.min(1, (now - p.born) / p.dur);
      if (byId.get(p.target.id)?.alive) p.x1 = p.target.x * CELL;
      const at = (k: number) => [p.x0 + (p.x1 - p.x0) * k, p.y0 + (p.y1 - p.y0) * k - p.arc * Math.sin(Math.PI * k)];
      const [x, y] = at(t), [x2, y2] = at(Math.min(1, t + 0.03));
      p.g.position.set(x, y);
      if (x2 !== x || y2 !== y) p.g.rotation = Math.atan2(y2 - y, x2 - x);
      if (t < 1) return true;
      if (p.dmg > 0 && p.pu) this.popupNow(p.pu, p.dmg, now);
      p.g.destroy();
      return false;
    });
  }

  /** Покачивание при ходьбе, рывок при атаке (рост attackCooldown), белая вспышка при уроне. */
  private animate(v: UnitView, u: Unit, now: number) {
    if (Math.abs(u.x - v.lastX) > 1e-4) v.moving = now + 120;
    v.lastX = u.x;
    const dir = u.side === 'party' ? 1 : -1;
    if (v.anim) {
      if (now >= v.actionUntil) { v.action = ''; this.setAnim(v, now < v.moving ? 'walk' : 'idle', true); }
      v.sprite.x = now - v.hurtAt < HURT_MS ? -dir * 3 * (1 - (now - v.hurtAt) / HURT_MS) : 0;
      v.sprite.tint = now < v.flash ? 0xffaaaa : 0xffffff;
      return;
    }
    const lt = (now - v.lunge) / LUNGE_MS;
    v.sprite.x = lt >= 0 && lt < 1 ? dir * 4 * Math.sin(Math.PI * lt) : 0;
    v.sprite.y = now < v.moving ? -Math.abs(Math.sin(now / 90 + u.id)) * 1.5 : 0;
    if (v.tex) v.sprite.texture = now < v.flash ? v.tex.flash : v.tex.tex;
    else v.sprite.tint = now < v.flash ? 0xffaaaa : 0xffffff;
  }

  private procOf(u: Unit): ProcTex {
    const base = { race: u.race, enemy: u.side === 'enemy' };
    if (u.kind === 'hero') {
      const form = get(save).heroes[u.refId]?.form ?? 0;
      return procSprite({ ...base, kind: 'hero', role: HEROES.get(u.refId)?.role, form });
    }
    if (u.kind === 'creep') return procSprite({ ...base, kind: 'creep', ctype: CREEP_TYPE.get(u.refId) });
    if (u.kind === 'mob') return procSprite({ ...base, kind: 'mob', ctype: u.refId === 'mob_ranged' ? 'ranged' : 'infantry' });
    return procSprite({ ...base, kind: u.kind, raid: u.refId === 'raid_boss' });
  }

  private frameOf(u: Unit): Texture | undefined {
    const sheet = this.sheets.get(u.race);
    if (!sheet) return undefined;
    const src = u.kind === 'hero' ? HEROES.get(u.refId)?.forms[0]?.sprite : CREEP_SPRITE.get(u.refId);
    if (!src) return undefined;
    return sheet.textures[src.split('/').pop()!] as Texture | undefined;
  }

  private makeView(u: Unit): UnitView {
    let { w, h } = dims(u);
    const root = new Container();
    const proto = this.protoOf(u);
    const form = u.kind === 'hero' ? Math.min(2, get(save).heroes[u.refId]?.form ?? 0) : 0;
    const frame = proto ? undefined : this.frameOf(u);
    let tex: ProcTex | undefined;
    let sprite: Sprite;
    let anim: AnimatedSprite | undefined;
    if (proto) {
      h = PROTO_H[u.kind]; w = h * 0.5;
      const k = proto.anchors[`f${form}`] ? form : 0;
      anim = new AnimatedSprite(proto.sheet.animations[`f${k}_idle`]);
      anim.anchor.set(...(proto.anchors[`f${k}`] ?? [0.5, 1]));
      const sc = h / (proto.charH[`f${k}`] || h);
      anim.scale.set(u.side === 'party' ? sc : -sc, sc); // враги смотрят влево
      anim.animationSpeed = 5 / 60;
      anim.play();
      sprite = anim;
    } else if (frame) {
      sprite = new Sprite(frame);
      sprite.anchor.set(0.5, 1);
      const k = h / frame.height;
      sprite.scale.set(u.side === 'party' ? k : -k, k); // враги смотрят влево
    } else {
      try {
        tex = this.procOf(u);
        ({ w, h } = { w: tex.w, h: tex.h });
        sprite = new Sprite(tex.tex);
        sprite.anchor.set(0.5, 1);
        sprite.scale.x = u.side === 'party' ? 1 : -1;
      } catch (e) { // крайний фоллбек: нет DOM-canvas и т.п.
        console.warn('процедурный спрайт не создан', e);
        sprite = new Sprite(Texture.WHITE);
        sprite.anchor.set(0.5, 1);
        sprite.tint = u.side === 'party' ? raceColor(u.race) : 0x883333;
        sprite.width = w; sprite.height = h;
      }
    }
    root.addChild(sprite);
    const hp = new Graphics();
    root.addChild(hp);
    this.world.addChild(root);
    const v: UnitView = {
      root, hp, w, h, sprite, tex, lastX: u.x, lastCd: u.attackCooldown, lunge: -1e9, flash: 0, moving: 0,
      proto, anim, form, cur: `f${form}_idle`, action: '', actionUntil: 0, hurtAt: -1e9,
    };
    this.views.set(u.id, v);
    return v;
  }

  /** Урон от выстрела показываем в момент прилёта снаряда, остальной — сразу. */
  private popup(u: Unit, dmg: number, now: number) {
    const p = this.projs.find(q => q.target.id === u.id && !q.pu);
    if (p) { p.dmg = dmg; p.pu = u; return; }
    this.popupNow(u, dmg, now);
  }

  private popupNow(u: Unit, dmg: number, now: number) {
    const n = Math.round(dmg);
    if (n < 1) return;
    const h = this.views.get(u.id)?.h ?? dims(u).h;
    const t = new Text({
      text: String(n),
      style: { fontFamily: 'monospace', fontSize: 12, fill: u.side === 'party' ? 0xff5555 : 0xffffff, stroke: { color: 0x000000, width: 2 } },
    });
    t.anchor.set(0.5, 1);
    t.position.set(u.x * CELL, GROUND_Y - h - 10);
    this.world.addChild(t);
    this.popups.push({ t, born: now, y0: t.y });
  }

  private updatePopups(now: number) {
    this.popups = this.popups.filter(p => {
      const age = now - p.born;
      if (age >= POPUP_MS) { p.t.destroy(); return false; }
      p.t.y = p.y0 - age * 0.03;
      p.t.alpha = 1 - age / POPUP_MS;
      return true;
    });
  }
}

function makeRow(): Row {
  const c = new Container();
  const g = new Graphics();
  const t = new Text({ text: '', style: TEXT_SMALL });
  c.addChild(g, t);
  return { c, g, t };
}

function drawBig(row: Row, s: BattleState, kind: 'boss' | 'base', label: string) {
  const u = s.units.find(x => x.alive && x.side === 'enemy' && x.kind === kind);
  row.c.visible = !!u;
  if (!u) return;
  const r = Math.max(0, u.hp / u.maxHp);
  row.g.clear().rect(8, 12, 344, 5).fill(0x222222).rect(8, 12, 344 * r, 5).fill(0xdd4444);
  row.t.text = `${label} ${Math.ceil(r * 100)}%`;
}

function dims(u: Unit): { w: number; h: number } {
  if (u.kind === 'base') return { w: 40, h: 60 };
  if (u.kind === 'boss') return { w: 28, h: 40 };
  if (u.kind === 'hero') return { w: 16, h: 28 };
  return { w: 10, h: 18 };
}

function drawHp(g: Graphics, u: Unit, w: number, h: number) {
  g.clear();
  g.rect(-w / 2, -h - 5, w, 3).fill(0x222222);
  g.rect(-w / 2, -h - 5, w * Math.max(0, u.hp / u.maxHp), 3).fill(u.side === 'party' ? 0x44dd44 : 0xdd4444);
}

function orbColor(race: Unit['race']): number {
  return parseInt((races.races as Record<string, { palette: string[] }>)[race].palette[3].slice(1), 16);
}

function raceColor(race: Unit['race']): number {
  return parseInt((races.races as Record<string, { palette: string[] }>)[race].palette[1].slice(1), 16);
}
