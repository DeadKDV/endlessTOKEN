/**
 * PixiJS-сцена боя. Логическое разрешение 360×640, масштаб пиксельный (CSS в index.html).
 * Камера неподвижна: поле от тылов отряда (x=-3) до вражеской базы (BASE_X) целиком на экране, земля на y=420.
 * Кадр юнита берётся из атласа public/atlases/<раса> (см. scripts/pack-atlas.mjs) по basename поля sprite;
 * без атласа — процедурный спрайт (procSprites), прямоугольник цвета расы — лишь крайний фоллбек.
 * Базы - здания (procSprites), в прото-слое их нет. Высший приоритет — покадровые атласы public/proto (index.json со списком id): нет файла — слой молча отключён.
 */
import { AnimatedSprite, Application, Assets, Container, Graphics, Sprite, Spritesheet, Text, Texture } from 'pixi.js';
import { get } from 'svelte/store';
import type { BattleState, CreepType, Role, Unit } from '../sim/types';
import { BASE_X } from '../sim/battle';
import { save } from '../game';
import { procSprite, type ProcTex } from './procSprites';
import { Backdrop } from './backdrop';
import { artIndex } from './artSet';
import { loadProto, peekProto, type Proto } from './atlasStore';
import { sfx } from '../audio/sfx';
import { mobRaceForFloor } from '../sim/races';
import { BattleFx } from './fx';
import races from '../data/races.json';
import creeps from '../data/creeps.json';

type HeroDef = { id: string; role: Role; race?: string; forms: { sprite?: string }[] };

export const LOGICAL_W = 360;
export const LOGICAL_H = 640;
const FIELD_L = -3;                             // тылы отряда
const FIELD_R = BASE_X + 1;                     // база прижата к правому краю
const CELL = LOGICAL_W / (FIELD_R - FIELD_L);   // пикселей на клетку: поле целиком на экране
import { GROUND_Y } from './layout';
const POPUP_MS = 800;
const PROTO_H: Record<Unit['kind'], number> = { hero: 56, creep: 32, mob: 38, boss: 84, base: 0 }; // рост прото-юнита, px (крип ~57% героя; базы - здания в коде)
const PROC_SCALE: Record<Unit['kind'], number> = { hero: 2, creep: 1.7, mob: 1.9, boss: 1.6, base: 1.4 }; // масштаб процедурных спрайтов
type ProjType = 'arrow' | 'bullet' | 'cannon' | 'orb' | 'heal';
const PROJ: Record<ProjType, { speed: number; arc: number }> = {
  arrow: { speed: 14, arc: 12 }, bullet: { speed: 34, arc: 0 }, cannon: { speed: 9, arc: 24 }, orb: { speed: 14, arc: 3 }, heal: { speed: 12, arc: 3 },
};
const ROWS = 3;            // ряды по глубине: юниты не стоят одной кучей
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
const PET_TINT: Record<string, number> = { elf: 0xb8f0a8, orc: 0x9cd67a, undead: 0xb8b0d8 }; // лиса Elthen перекрашивается по расе героя
const PET_X = -14, PET_Y = -4;                   // где петомец стоит относительно героя: сзади и чуть выше
const TEXT_SMALL = { fontFamily: 'monospace', fontSize: 10, fill: 0xffffff };

interface UnitView {
  root: Container; hp: Graphics; w: number; h: number; kind: Unit['kind']; dx: number; dy: number;
  sprite: Sprite; tex?: ProcTex; baseTint: number;
  lastX: number; lastCd: number; lunge: number; flash: number; moving: number;
  sig: string; pet?: PetView; copies?: Sprite[]; glow?: Graphics;
  proto?: Proto; anim?: AnimatedSprite; form: number; cur: string; action: string; actionUntil: number; hurtAt: number;
}
interface PetView {
  c: Container; spr: Sprite; anim?: AnimatedSprite; proto?: Proto; aura?: Graphics; ox: number; oy: number;
  lastRx: number; lastT: number; lastLunge: number; cur: string; until: number;
}
type PopKind = 'dmg' | 'crit' | 'heal' | 'base';
interface Proj {
  g: Graphics; x0: number; y0: number; x1: number; y1: number; born: number; dur: number; arc: number;
  target: Unit; tdx: number; dmg: number; pu?: Unit; fx?: boolean; pk?: PopKind;
}
interface Popup { t: Text; born: number; y0: number }
interface Row { c: Container; g: Graphics; t: Text }

export class BattleView {
  app = new Application();
  world = new Container();
  private views = new Map<number, UnitView>();
  private dying: { v: UnitView; born: number; deb?: { g: Graphics; vx: number; vy: number }[] }[] = [];
  private backdrop = new Backdrop(GROUND_Y, LOGICAL_H);
  private lastHp = new Map<number, number>();
  private ema = new Map<number, number>(); // средний удар по цели: заметно больший считаем критом
  private lastHeal = new Map<number, number>();
  private fx!: BattleFx;
  private sheets = new Map<string, Spritesheet>();
  private projs: Proj[] = [];
  private popups: Popup[] = [];
  private bossRow = makeRow();
  private baseRow = makeRow();
  private ownBaseRow = makeRow();
  private floorLabel = new Text({ text: '', style: { fontFamily: 'monospace', fontSize: 11, fill: 0xffffff } });

  async init(host: HTMLElement) {
    await this.app.init({ width: LOGICAL_W, height: LOGICAL_H, background: '#0b0b12', antialias: false, resolution: 1 });
    this.app.canvas.style.width = '100%';
    this.app.canvas.style.height = '100%';
    host.appendChild(this.app.canvas);
    this.bossRow.c.position.set(0, 42);
    this.baseRow.c.position.set(0, 62);
    this.ownBaseRow.c.position.set(0, 62);
    this.floorLabel.position.set(8, GROUND_Y + 4);
    this.world.x = -FIELD_L * CELL;
    this.world.sortableChildren = true;
    this.fx = new BattleFx(this.app.stage, this.app.renderer, id => {
      const v = this.views.get(id);
      return v && { x: v.root.x, y: v.root.y, h: v.h, w: v.w };
    }, { x: 14 - this.world.x, y: 12 }, LOGICAL_W, LOGICAL_H, CELL);
    this.fx.layer.zIndex = 2000;
    this.world.addChild(this.fx.layer);
    this.app.stage.addChild(this.backdrop, this.world, this.bossRow.c, this.baseRow.c, this.ownBaseRow.c, this.floorLabel);
    await this.loadAtlases();
    void this.preload();
  }

  render(s: BattleState) {
    const now = performance.now();
    this.backdrop.scroll(0);
    const byId = new Map(s.units.map(u => [u.id, u]));
    for (const u of s.units) {
      if (!u.alive || u.pending) continue;
      let v = this.views.get(u.id) ?? this.makeView(u);
      if ((!v.proto && this.protoOf(u)) || v.sig !== this.sigOf(u)) { // атлас догрузился или сменились форма/петомец - пересоздаём вид
        v.root.destroy({ children: true });
        v = this.makeView(u);
      }
      if (u.attackCooldown > v.lastCd + 1e-6) this.onAttack(v, u, s, now);
      v.lastCd = u.attackCooldown;
    }

    const seen = new Set<number>();
    const hp = new Map<number, number>();
    for (const u of s.units) {
      const prev = this.lastHp.get(u.id);
      if (prev !== undefined && u.hp < prev) this.popup(u, prev - u.hp, now);
      else if (prev !== undefined && u.hp - prev >= 1 && u.alive && u.kind !== 'base' && now - (this.lastHeal.get(u.id) ?? 0) > 300) {
        this.lastHeal.set(u.id, now);
        const hv = this.views.get(u.id);
        if (hv) { this.popupNow(u, u.hp - prev, now, 'heal'); this.fx.heal(hv.root.x, hv.root.y - hv.h * 0.6); }
      }
      hp.set(u.id, u.hp);
      if (!u.alive || u.pending) continue;
      seen.add(u.id);
      const v = this.views.get(u.id)!;
      if (prev !== undefined && u.hp < prev) { v.flash = now + FLASH_MS; v.hurtAt = now; this.act(v, 'hurt', HURT_MS, now); }
      this.animate(v, u, now);
      const px = u.x * CELL;
      // база не вылезает за края экрана
      const half = v.sprite.width / 2;
      v.root.position.set(u.kind === 'base' ? Math.min(Math.max(px, 2 + (FIELD_L * CELL) + half), LOGICAL_W - 2 + FIELD_L * CELL - half) : px + v.dx, GROUND_Y + v.dy);
      v.root.zIndex = u.kind === 'base' ? 0 : GROUND_Y + v.dy;
      if (v.pet) this.animatePet(v, v.pet, now);
      if (u.kind !== 'base') drawHp(v.hp, u, v.w, v.h);
    }
    this.lastHp = hp;
    for (const [id, v] of this.views) if (!seen.has(id)) {
      const du = byId.get(id);
      if (du && !du.alive && du.side === 'enemy' && !du.temp) {
        if (du.kind === 'base') { this.fx.shake(8, 600, now); sfx('base'); }
        else { this.fx.coins(v.root.x, v.root.y - v.h * 0.4, du.kind === 'boss' ? 8 : 2); sfx('coin'); }
      }
      if (du && du.kind !== 'base' && !du.temp) sfx('death');
      for (const e of [...(v.copies ?? []), v.glow, v.pet?.c]) if (e) e.visible = false; // питомец и обводка исчезают сразу
      if (v.anim) this.setAnim(v, 'death', false, DEATH_MS);
      this.dying.push({ v, born: now, deb: v.kind === 'base' ? this.debris(v) : undefined }); this.views.delete(id);
    }
    this.dying = this.dying.filter(d => {
      if (d.deb) return this.collapse(d, now);
      const a = 1 - (now - d.born - (d.v.anim ? DEATH_MS : 0)) / FADE_MS;
      if (a <= 0) { d.v.root.destroy({ children: true }); return false; }
      d.v.root.alpha = Math.min(1, a);
      return true;
    });

    this.fx.update(s, now, (u, i) => u.kind === 'hero' && i === 2 && get(save).heroes[u.refId]?.form === 2);
    this.updateProjs(now, byId);
    this.updatePopups(now);
    drawBig(this.bossRow, s, 'enemy', 'boss', 8, 344, 'Босс', 0xdd4444);
    drawBig(this.ownBaseRow, s, 'party', 'base', 8, 166, 'Наша база', 0x44bb55);
    drawBig(this.baseRow, s, 'enemy', 'base', 186, 166, 'База врага', 0xdd4444);
    this.floorLabel.text = `Этаж ${s.floor} · волна ${s.wave}`;
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

  /** Герои отряда, их крипы и мобы расы текущего этажа - до первого появления на поле. */
  private async preload() {
    const set = await artIndex();
    if (!set) return;
    const sv = get(save), races = new Set<string>();
    for (const id of sv.party) {
      loadProto(id);
      const r = HEROES.get(id)?.race;
      if (r) races.add(r);
    }
    for (const r of races) for (const t of ['infantry', 'ranged', 'healer']) loadProto(`${r}_${t}`);
    const mob = mobRaceForFloor(sv.floor);
    for (const t of ['mob_melee', 'mob_ranged', 'boss']) loadProto(`${mob}_${t}`);
  }

  private protoId(u: Unit): string | undefined {
    if (u.kind === 'base') return undefined; // базы - здания, не юниты EF
    return u.kind === 'hero' || u.kind === 'creep' ? u.refId : `${u.race}_${u.refId}`;
  }

  /** Атлас юнита, если уже загружен; иначе запускает загрузку (до неё рисуется процедурный спрайт). */
  private protoOf(u: Unit): Proto | undefined {
    const id = this.protoId(u);
    if (!id) return undefined;
    const p = peekProto(id);
    if (!p) void loadProto(id);
    return p;
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
    if (u.stats.range <= 1.5 || u.kind === 'base') { if (u.kind !== 'base') sfx('sword'); return; }
    const heals = (u.healPower ?? 0) > 0 || CREEP_TYPE.get(u.refId) === 'healer';
    const cands = s.units.filter(o => o.alive && o.id !== u.id && (heals ? o.side === u.side : o.side !== u.side));
    if (!cands.length) return;
    const t = heals
      ? cands.reduce((a, b) => (b.hp / b.maxHp < a.hp / a.maxHp ? b : a))
      : cands.reduce((a, b) => (Math.abs(b.x - u.x) < Math.abs(a.x - u.x) ? b : a));
    const type = this.protoOf(u)?.projectile ?? (heals ? 'heal' : (u.kind === 'creep' ? CREEP_TYPE.get(u.refId) === 'ranged' : HEROES.get(u.refId)?.role === 'ranger') ? 'arrow' : 'orb');
    sfx(heals ? 'heal' : type === 'arrow' ? 'arrow' : type === 'orb' ? 'orb' : 'bullet');
    const tv = this.views.get(t.id);
    const dir = t.x >= u.x ? 1 : -1;
    const x0 = u.x * CELL + v.dx + dir * 6, y0 = GROUND_Y + v.dy - v.h * 0.6;
    const x1 = t.x * CELL + (tv?.dx ?? 0), y1 = GROUND_Y + (tv?.dy ?? 0) - (tv?.h ?? 20) * 0.55;
    const dist = Math.hypot(x1 - x0, y1 - y0), P = PROJ[type];
    this.projs.push({ g: projGfx(type, u.race), x0, y0, x1, y1, born: now, dur: Math.max(70, dist / (P.speed * CELL) * 1000), arc: P.arc, target: t, tdx: tv?.dx ?? 0, dmg: 0 });
    const pg = this.projs[this.projs.length - 1].g;
    pg.zIndex = 1000; this.world.addChild(pg);
    if (type === 'bullet') { // вспышка у ствола
      const f = new Graphics().circle(0, 0, 4).fill({ color: 0xffe066, alpha: 0.9 }).circle(0, 0, 2).fill(0xffffff);
      f.position.set(x0, y0); f.zIndex = 1000; this.world.addChild(f);
      this.projs.push({ g: f, x0, y0, x1: x0, y1: y0, born: now, dur: 90, arc: 0, target: t, tdx: 0, dmg: 0, fx: true });
    }
  }

  private updateProjs(now: number, byId: Map<number, Unit>) {
    this.projs = this.projs.filter(p => {
      const t = Math.min(1, (now - p.born) / p.dur);
      if (!p.fx && byId.get(p.target.id)?.alive) p.x1 = p.target.x * CELL + p.tdx;
      if (p.fx) p.g.alpha = 1 - t;
      const at = (k: number) => [p.x0 + (p.x1 - p.x0) * k, p.y0 + (p.y1 - p.y0) * k - p.arc * Math.sin(Math.PI * k)];
      const [x, y] = at(t), [x2, y2] = at(Math.min(1, t + 0.03));
      p.g.position.set(x, y);
      if (!p.fx && (x2 !== x || y2 !== y)) p.g.rotation = Math.atan2(y2 - y, x2 - x);
      if (t < 1) return true;
      if (p.dmg > 0 && p.pu) this.popupNow(p.pu, p.dmg, now, p.pk);
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
      v.sprite.tint = now < v.flash ? 0xffaaaa : v.baseTint;
      v.copies?.forEach((c, i) => {
        c.texture = v.anim!.texture; c.scale.copyFrom(v.sprite.scale);
        c.position.set(v.sprite.x + (i ? 1.5 : -1.5), v.sprite.y - 1.2);
      });
      this.pulseGlow(v, now);
      return;
    }
    const lt = (now - v.lunge) / LUNGE_MS;
    v.sprite.x = lt >= 0 && lt < 1 ? dir * 4 * Math.sin(Math.PI * lt) : 0;
    v.sprite.y = now < v.moving ? -Math.abs(Math.sin(now / 90 + u.id)) * 1.5 : 0;
    this.pulseGlow(v, now);
    if (v.tex) v.sprite.texture = now < v.flash ? v.tex.flash : v.tex.tex;
    else v.sprite.tint = now < v.flash ? 0xffaaaa : v.baseTint;
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
        const k = PROC_SCALE[u.kind];
        ({ w, h } = { w: tex.w * k, h: tex.h * k });
        sprite = new Sprite(tex.tex);
        sprite.anchor.set(0.5, 1);
        sprite.scale.set(u.side === 'party' ? k : -k, k);
      } catch (e) { // крайний фоллбек: нет DOM-canvas и т.п.
        console.warn('процедурный спрайт не создан', e);
        sprite = new Sprite(Texture.WHITE);
        sprite.anchor.set(0.5, 1);
        sprite.tint = u.side === 'party' ? raceColor(u.race) : 0x883333;
        sprite.width = w; sprite.height = h;
      }
    }
    const extras = u.kind === 'hero' ? this.heroExtras(u, root, h, form, proto, anim) : {};
    root.addChild(sprite);
    const base = u.kind === 'base';
    const dy = base ? 0 : ((u.id % ROWS) - 1) * 7, dx = base ? 0 : (((u.id * 5) % 7) - 3) * 1.2; // только визуально
    const hp = new Graphics();
    root.addChild(hp);
    this.world.addChild(root);
    const v: UnitView = {
      root, hp, w, h, kind: u.kind, dx, dy, sprite, tex, lastX: u.x, lastCd: u.attackCooldown, lunge: -1e9, flash: 0, moving: 0,
      baseTint: proto?.tint ?? sprite.tint, proto, sig: this.sigOf(u), ...extras, anim, form, cur: `f${form}_idle`, action: '', actionUntil: 0, hurtAt: -1e9,
    };
    this.views.set(u.id, v);
    return v;
  }

  /** Признак, при смене которого вид героя надо пересоздать: форма, ступень петомца, готовность атласа лисы. */
  private sigOf(u: Unit): string {
    if (u.kind !== 'hero') return '';
    const h = get(save).heroes[u.refId], pet = h?.pet ?? 0;
    if (pet > 0) void loadProto('pet_fox');
    return `${h?.form ?? 0}|${pet >= 30 ? 3 : pet >= 20 ? 2 : pet >= 1 ? 1 : 0}|${peekProto('pet_fox') ? 1 : 0}`;
  }

  /** Заметность формы (золотая обводка двумя копиями, свечение под ногами у формы 2) и петомец; всё добавляется под спрайт героя. */
  private heroExtras(u: Unit, root: Container, h: number, form: number, proto?: Proto, anim?: AnimatedSprite) {
    const out: { glow?: Graphics; copies?: Sprite[]; pet?: PetView } = {};
    if (form >= 2) {
      out.glow = new Graphics().ellipse(0, -1, h * 0.42, 4).fill({ color: 0xffd54f, alpha: 0.35 }).ellipse(0, -1, h * 0.26, 2.5).fill({ color: 0xffe9a0, alpha: 0.5 });
      root.addChild(out.glow);
    }
    out.pet = this.makePet(u, root);
    const an = proto?.sheet.animations;
    // у Elthen/Zerie одна внешность на все формы - отличаем обводкой; у атласов со своими кадрами формы уже разные
    if (form >= 1 && anim && an && an.f1_idle?.[0] === an.f0_idle?.[0]) {
      out.copies = [0, 1].map(() => {
        const c = new Sprite(anim.texture);
        c.anchor.copyFrom(anim.anchor); c.tint = 0xffd54f;
        root.addChild(c);
        return c;
      });
    }
    return out;
  }

  private pulseGlow(v: UnitView, now: number) {
    if (!v.glow) return;
    const k = Math.sin(now / 260);
    v.glow.alpha = 0.75 + 0.25 * k; v.glow.scale.set(1 + 0.1 * k, 1);
  }

  private makePet(u: Unit, root: Container): PetView | undefined {
    const lvl = get(save).heroes[u.refId]?.pet ?? 0;
    if (lvl < 1) return undefined;
    const H = lvl >= 30 ? 22 : 16, proto = peekProto('pet_fox');
    const c = new Container();
    let spr: Sprite, anim: AnimatedSprite | undefined, aura: Graphics | undefined;
    if (proto) {
      anim = new AnimatedSprite(proto.sheet.animations.f0_idle);
      anim.anchor.set(...(proto.anchors.f0 ?? [0.5, 1]));
      anim.scale.set(H / (proto.charH.f0 || H));
      anim.animationSpeed = 5 / 60; anim.tint = PET_TINT[u.race] ?? 0xffffff; anim.play();
      spr = anim;
    } else {
      const t = procSprite({ race: u.race, enemy: false, kind: 'pet' });
      spr = new Sprite(t.tex);
      spr.anchor.set(0.5, 1); spr.scale.set(H / t.h);
    }
    if (lvl >= 20) { // аура петомца 20+
      const col = orbColor(u.race);
      aura = new Graphics().circle(0, -H / 2, H * 0.85).fill({ color: col, alpha: 0.16 }).circle(0, -H / 2, H * 0.55).fill({ color: col, alpha: 0.2 });
      c.addChild(aura);
    }
    c.addChild(spr);
    root.addChild(c);
    c.position.set(PET_X, PET_Y);
    return { c, spr, anim, proto, aura, ox: PET_X, oy: PET_Y, lastRx: NaN, lastT: performance.now(), lastLunge: -1e9, cur: 'f0_idle', until: 0 };
  }

  /** Петомец остаётся на месте мира, пока герой уходит вперёд, и догоняет к точке позади героя; рывок вместе с атакой героя. */
  private animatePet(v: UnitView, p: PetView, now: number) {
    const dt = Math.min(100, now - p.lastT);
    p.lastT = now;
    const rx = v.root.x;
    if (!Number.isNaN(p.lastRx)) p.ox -= rx - p.lastRx;
    p.lastRx = rx;
    const k = 1 - Math.exp(-dt / 140), moving = now < v.moving;
    const ty = PET_Y - (moving ? Math.abs(Math.sin(now / 100)) * 2 : 0);
    p.ox = Math.min(PET_X + 10, Math.max(PET_X - 28, p.ox + (PET_X - p.ox) * k));
    p.oy += (ty - p.oy) * k;
    const lt = (now - v.lunge) / LUNGE_MS;
    p.c.position.set(p.ox + (lt >= 0 && lt < 1 ? 9 * Math.sin(Math.PI * lt) : 0), p.oy);
    if (p.aura) p.aura.alpha = 0.7 + 0.3 * Math.sin(now / 300);
    const a = p.anim;
    if (!a || !p.proto) return;
    if (p.lastLunge !== v.lunge) { p.lastLunge = v.lunge; p.until = now + ATTACK_MS; this.setPetAnim(p, 'attack', false, ATTACK_MS); }
    else if (now >= p.until) this.setPetAnim(p, moving || Math.abs(PET_X - p.ox) > 1.5 ? 'walk' : 'idle', true);
  }

  private setPetAnim(p: PetView, name: string, loop: boolean, durMs?: number) {
    const key = `f0_${name}`, frames = p.proto!.sheet.animations[key], a = p.anim!;
    if (!frames || (p.cur === key && loop)) return;
    p.cur = key;
    a.loop = loop; a.textures = frames;
    a.animationSpeed = (durMs ? frames.length / (durMs / 1000) : name === 'walk' ? 12 : 5) / 60;
    a.gotoAndPlay(0);
  }

  private debris(v: UnitView) {
    return Array.from({ length: 12 }, (_, i) => {
      const g = new Graphics().rect(-2, -2, 4, 4).fill(i % 3 ? 0x6a6a7a : 0x3a3a48);
      g.position.set(v.root.x + (Math.random() - 0.5) * v.w * 0.6, GROUND_Y - Math.random() * v.h * 0.6);
      g.zIndex = 1000; this.world.addChild(g);
      return { g, vx: (Math.random() - 0.5) * 120, vy: -40 - Math.random() * 90 };
    });
  }

  /** Разрушение базы: оседает в землю с вспышкой, летят обломки. */
  private collapse(d: { v: UnitView; born: number; deb?: { g: Graphics; vx: number; vy: number }[] }, now: number): boolean {
    const t = (now - d.born) / 900;
    if (t >= 1) { d.v.root.destroy({ children: true }); d.deb!.forEach(e => e.g.destroy()); return false; }
    d.v.root.scale.y = Math.max(0.05, 1 - t);
    d.v.root.alpha = Math.min(1, 2 - 2 * t);
    d.v.sprite.tint = t < 0.15 ? 0xffffff : 0x999999;
    d.deb!.forEach(e => { e.vy += 5; e.g.x += e.vx / 60; e.g.y += e.vy / 60; e.g.alpha = 1 - t; });
    return true;
  }

  /** Урон от выстрела показываем в момент прилёта снаряда, остальной — сразу. */
  private popup(u: Unit, dmg: number, now: number) {
    const avg = this.ema.get(u.id);
    const crit = avg !== undefined && dmg > avg * 1.6;
    this.ema.set(u.id, avg === undefined ? dmg : avg * 0.8 + Math.min(dmg, avg * 1.3) * 0.2);
    const pk: PopKind = u.kind === 'base' ? 'base' : crit ? 'crit' : 'dmg';
    if (crit) sfx('crit');
    const p = this.projs.find(q => q.target.id === u.id && !q.pu && !q.fx);
    if (p) { p.dmg = dmg; p.pu = u; p.pk = pk; return; }
    this.popupNow(u, dmg, now, pk);
  }

  private popupNow(u: Unit, dmg: number, now: number, kind: PopKind = 'dmg') {
    const n = Math.round(dmg);
    if (n < 1) return;
    const pv = this.views.get(u.id);
    const h = pv?.h ?? dims(u).h;
    const t = new Text({
      text: kind === 'heal' ? `+${n}` : kind === 'crit' ? `${n}!` : kind === 'base' ? `-${n}` : String(n),
      style: {
        fontFamily: 'monospace', fontWeight: kind === 'dmg' ? 'normal' : 'bold', stroke: { color: 0x000000, width: kind === 'crit' ? 3 : 2 },
        fontSize: kind === 'crit' ? 18 : kind === 'base' ? 15 : 12,
        fill: kind === 'heal' ? 0x66ff88 : kind === 'crit' ? 0xffc83a : kind === 'base' ? 0xff9933 : u.side === 'party' ? 0xff5555 : 0xffffff,
      },
    });
    t.anchor.set(0.5, 1);
    t.zIndex = 1000;
    t.position.set(u.x * CELL + (pv?.dx ?? 0), GROUND_Y + (pv?.dy ?? 0) - h - 10);
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

function drawBig(row: Row, s: BattleState, side: Unit['side'], kind: 'boss' | 'base', x: number, w: number, label: string, color: number) {
  const u = s.units.find(q => q.alive && q.side === side && q.kind === kind);
  row.c.visible = !!u;
  if (!u) return;
  const r = Math.max(0, u.hp / u.maxHp);
  row.g.clear().rect(x, 12, w, 5).fill(0x222222).rect(x, 12, w * r, 5).fill(color);
  row.t.text = `${label} ${Math.ceil(r * 100)}%`;
  row.t.x = x;
}

function dims(u: Unit): { w: number; h: number } {
  if (u.kind === 'base') return { w: 40, h: 60 };
  if (u.kind === 'boss') return { w: 28, h: 40 };
  if (u.kind === 'hero') return { w: 16, h: 28 };
  if (u.kind === 'mob') return { w: 11, h: 20 };
  return { w: 9, h: 16 };
}

/** Снаряд по типу оружия; рисуется в сторону +x, поворот задаёт updateProjs. */
function projGfx(type: ProjType, race: Unit['race']): Graphics {
  const g = new Graphics();
  if (type === 'arrow') {
    g.moveTo(-9, 0).lineTo(3, 0).stroke({ color: 0xd7ccc8, width: 1.5 });
    g.poly([3, -2.5, 8, 0, 3, 2.5]).fill(0xeceff1);
    g.poly([-9, 0, -11, -2, -7, 0, -11, 2]).fill(0xc0392b);
  } else if (type === 'bullet') {
    g.rect(-9, -1, 8, 2).fill({ color: 0xffd54f, alpha: 0.55 }).rect(-3, -1, 5, 2).fill(0xffe066).rect(1, -1, 2, 2).fill(0xffffff);
  } else if (type === 'cannon') {
    g.circle(0, 0, 4).fill(0x2b2b33).circle(-1, -1.2, 1.4).fill(0x8a8a99);
  } else {
    const c = type === 'heal' ? 0x66ff88 : orbColor(race);
    g.circle(0, 0, type === 'heal' ? 5 : 6).fill({ color: c, alpha: 0.3 }).circle(0, 0, 3.2).fill(c).circle(-0.8, -0.8, 1.2).fill(0xffffff);
  }
  return g;
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
