/**
 * PixiJS-сцена боя. Вертикальный экран 9:16, логическое разрешение 360×640, масштаб пиксельный.
 * Спрайтов пока нет — юниты рисуются прямоугольниками цвета расы; замена на спрайты — в drawUnit().
 */
import { Application, Container, Graphics, Text } from 'pixi.js';
import type { BattleState, Unit } from '../sim/types';
import races from '../data/races.json';

export const LOGICAL_W = 360;
export const LOGICAL_H = 640;
const CELL = 24;           // пикселей на игровую клетку
const GROUND_Y = 420;      // линия земли в логических пикселях
const BATTLE_TOP = 120;    // область боя 120..440, остальное — UI

export class BattleView {
  app = new Application();
  world = new Container();
  private sprites = new Map<number, Graphics>();
  private hud = new Text({ text: '', style: { fontFamily: 'monospace', fontSize: 12, fill: 0xffffff } });

  async init(host: HTMLElement) {
    await this.app.init({ width: LOGICAL_W, height: LOGICAL_H, background: '#0b0b12', antialias: false, resolution: 1 });
    this.app.canvas.style.width = '100%';
    this.app.canvas.style.height = '100%';
    host.appendChild(this.app.canvas);
    const ground = new Graphics().rect(0, GROUND_Y, LOGICAL_W, 20).fill(0x2a2a3a);
    this.app.stage.addChild(ground, this.world, this.hud);
    this.hud.position.set(8, BATTLE_TOP - 20);
  }

  render(s: BattleState) {
    const camX = Math.max(0, ...s.units.filter(u => u.alive && u.side === 'party').map(u => u.x)) - 3;
    this.world.x = -camX * CELL;
    const seen = new Set<number>();
    for (const u of s.units) {
      if (!u.alive) continue;
      seen.add(u.id);
      let g = this.sprites.get(u.id);
      if (!g) { g = new Graphics(); this.world.addChild(g); this.sprites.set(u.id, g); }
      drawUnit(g, u);
      g.position.set(u.x * CELL, GROUND_Y);
    }
    for (const [id, g] of this.sprites) if (!seen.has(id)) { g.destroy(); this.sprites.delete(id); }
    this.hud.text = `Этаж ${s.floor}  волна ${s.wave}  тик ${s.tick}`;
  }
}

function drawUnit(g: Graphics, u: Unit) {
  const w = u.kind === 'base' ? 40 : u.kind === 'boss' ? 28 : u.kind === 'hero' ? 16 : 10;
  const h = u.kind === 'base' ? 60 : u.kind === 'boss' ? 40 : u.kind === 'hero' ? 28 : 18;
  const color = parseInt((races.races as any)[u.race].palette[1].slice(1), 16);
  g.clear();
  g.rect(-w / 2, -h, w, h).fill(u.side === 'party' ? color : 0x883333);
  // полоска HP
  g.rect(-w / 2, -h - 5, w, 3).fill(0x222222);
  g.rect(-w / 2, -h - 5, w * Math.max(0, u.hp / u.maxHp), 3).fill(u.side === 'party' ? 0x44dd44 : 0xdd4444);
}
