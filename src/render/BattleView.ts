/**
 * PixiJS-сцена боя. Логическое разрешение 360×640, масштаб пиксельный (CSS в index.html).
 * Бой в полосе 40..440, земля на y=420. Кадр юнита берётся из атласа public/atlases/<раса>
 * (см. scripts/pack-atlas.mjs) по basename поля sprite; без атласа — процедурный спрайт (procSprites),
 * прямоугольник цвета расы — лишь крайний фоллбек.
 */
import { Application, Assets, Container, Graphics, Sprite, Spritesheet, Text, Texture } from 'pixi.js';
import { get } from 'svelte/store';
import type { BattleState, CreepType, Role, Unit } from '../sim/types';
import { save } from '../game';
import { procSprite, type ProcTex } from './procSprites';
import { Backdrop } from './backdrop';
import races from '../data/races.json';
import creeps from '../data/creeps.json';
import economy from '../data/economy.json';

type HeroDef = { id: string; role: Role; forms: { sprite?: string }[] };

export const LOGICAL_W = 360;
export const LOGICAL_H = 640;
const CELL = 18;           // пикселей на игровую клетку: видно ~20 клеток, бой влезает целиком
const CAM_LEAD = 5;        // клеток позади переднего бойца отряда
const GROUND_Y = 420;      // линия земли в логических пикселях
const WAVES = economy.floor.wavesPerFloor;
const POPUP_MS = 800;

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

interface UnitView {
  root: Container; hp: Graphics; w: number; h: number;
  sprite: Sprite; tex?: ProcTex;
  lastX: number; lastCd: number; lunge: number; flash: number; moving: number;
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
    this.app.stage.addChild(this.backdrop, this.world, this.bossRow.c, this.baseRow.c, this.floorLabel);
    await this.loadAtlases();
  }

  render(s: BattleState) {
    const now = performance.now();
    const front = Math.max(0, ...s.units.filter(u => u.alive && u.side === 'party').map(u => u.x));
    this.world.x = -(front - CAM_LEAD) * CELL;
    this.backdrop.scroll(this.world.x);

    const seen = new Set<number>();
    const hp = new Map<number, number>();
    for (const u of s.units) {
      const prev = this.lastHp.get(u.id);
      if (prev !== undefined && u.hp < prev) this.popup(u, prev - u.hp, now);
      hp.set(u.id, u.hp);
      if (!u.alive) continue;
      seen.add(u.id);
      const v = this.views.get(u.id) ?? this.makeView(u);
      if (prev !== undefined && u.hp < prev) v.flash = now + FLASH_MS;
      this.animate(v, u, now);
      v.root.position.set(u.x * CELL, GROUND_Y);
      drawHp(v.hp, u, v.w, v.h);
    }
    this.lastHp = hp;
    for (const [id, v] of this.views) if (!seen.has(id)) { this.dying.push({ v, born: now }); this.views.delete(id); }
    this.dying = this.dying.filter(d => {
      const a = 1 - (now - d.born) / FADE_MS;
      if (a <= 0) { d.v.root.destroy({ children: true }); return false; }
      d.v.root.alpha = a;
      return true;
    });

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

  /** Покачивание при ходьбе, рывок при атаке (рост attackCooldown), белая вспышка при уроне. */
  private animate(v: UnitView, u: Unit, now: number) {
    if (Math.abs(u.x - v.lastX) > 1e-4) v.moving = now + 120;
    v.lastX = u.x;
    if (u.attackCooldown > v.lastCd + 1e-6) v.lunge = now;
    v.lastCd = u.attackCooldown;
    const dir = u.side === 'party' ? 1 : -1;
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
    const frame = this.frameOf(u);
    let tex: ProcTex | undefined;
    let sprite: Sprite;
    if (frame) {
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
    const v: UnitView = { root, hp, w, h, sprite, tex, lastX: u.x, lastCd: u.attackCooldown, lunge: -1e9, flash: 0, moving: 0 };
    this.views.set(u.id, v);
    return v;
  }

  private popup(u: Unit, dmg: number, now: number) {
    const n = Math.round(dmg);
    if (n < 1) return;
    const { h } = dims(u);
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

function raceColor(race: Unit['race']): number {
  return parseInt((races.races as Record<string, { palette: string[] }>)[race].palette[1].slice(1), 16);
}
