/** Задник кодом: небо-градиент полосами, два слоя гор и земля с травой/камнями. Параллакс через tilePosition. */
import { Container, TilingSprite, Sprite, Texture, Assets } from 'pixi.js';
import { artSet } from './artSet';

const W = 360;
let seed = 7;
const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;

function canvasTex(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void): Texture {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d')!);
  const t = Texture.from(c);
  t.source.scaleMode = 'nearest';
  t.source.addressMode = 'repeat';
  return t;
}

const mix = (a: number[], b: number[], t: number) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;

/** Тон сцены по расе мобов этажа: небо (верх/низ), множитель цвета гор, земли и леса, яркость звёзд. */
const TONE: Record<string, { top: number[]; low: number[]; tint: number; stars: number }> = {
  undead: { top: [20, 18, 52], low: [98, 80, 152], tint: 0x8a86c4, stars: 0.8 },
  elf: { top: [88, 170, 214], low: [204, 238, 190], tint: 0xe4ffd8, stars: 0 },
  dwarf: { top: [72, 38, 24], low: [228, 152, 66], tint: 0xf0b878, stars: 0.15 },
  human: { top: [70, 130, 214], low: [192, 216, 238], tint: 0xffffff, stars: 0 },
  orc: { top: [70, 24, 24], low: [216, 112, 78], tint: 0xe89a88, stars: 0.2 },
};
const rgb = (n: number) => [(n >> 16) & 255, (n >> 8) & 255, n & 255];

function sky(h: number, race: string): Texture {
  return canvasTex(W, h, c => {
    const { top, low, stars } = TONE[race] ?? TONE.human;
    const bands = 28;
    for (let b = 0; b < bands; b++) {
      c.fillStyle = mix(top, low, b / (bands - 1));
      c.fillRect(0, Math.floor(b * h / bands), W, Math.ceil(h / bands));
    }
    if (stars) for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(255,255,255,${artSet() === 'elthen' ? stars * 0.4 : stars})`; c.fillRect(Math.floor(rnd() * W), Math.floor(rnd() * h * 0.5), 1, 1); }
  });
}

/** Горы: сумма синусов с целыми периодами — стык по краям бесшовный. */
function mountains(h: number, color: string, amp: number, ks: number[]): Texture {
  const ph = ks.map(() => rnd() * 6.28);
  return canvasTex(W, h, c => {
    c.fillStyle = color;
    for (let x = 0; x < W; x++) {
      const v = ks.reduce((s, k, i) => s + Math.sin(2 * Math.PI * k * x / W + ph[i]) / (i + 1), 0);
      const top = Math.round(h - amp * (0.55 + 0.25 * v));
      c.fillRect(x, top - (top % 3), 1, h);
    }
  });
}

function ground(h: number): Texture {
  return canvasTex(W, h, c => {
    c.fillStyle = '#4a3a2a'; c.fillRect(0, 0, W, h);
    c.fillStyle = '#3a2d20';
    for (let i = 0; i < 90; i++) c.fillRect(Math.floor(rnd() * W), 8 + Math.floor(rnd() * (h - 8)), 2, 1);
    c.fillStyle = '#3f7a35'; c.fillRect(0, 2, W, 5);
    c.fillStyle = '#2f5f2a'; c.fillRect(0, 6, W, 2);
    for (let x = 0; x < W; x += 2) {
      const bl = 1 + Math.floor(rnd() * 2);
      c.fillStyle = rnd() < 0.5 ? '#58a048' : '#3f7a35';
      c.fillRect(x, 2 - bl, 1, bl);
    }
    for (let i = 0; i < 9; i++) {
      const x = Math.floor(rnd() * (W - 6)), y = 10 + Math.floor(rnd() * 14);
      c.fillStyle = '#6d6d7a'; c.fillRect(x, y, 5, 3);
      c.fillStyle = '#8c8c9a'; c.fillRect(x + 1, y, 3, 1);
      c.fillStyle = '#4d4d5a'; c.fillRect(x, y + 3, 5, 1);
    }
  });
}

export class Backdrop extends Container {
  private layers: { s: TilingSprite; f: number }[] = [];
  private skyBack: TilingSprite;
  private skyTop: TilingSprite;
  private skies = new Map<string, Texture>();
  private forest?: Sprite;
  private race = '';
  private fadeAt = 0;
  private last = 0;
  private cur = rgb(0xffffff);
  private to = rgb(0xffffff);
  constructor(private groundY: number, height: number) {
    super();
    const add = (t: Texture, y: number, f: number) => {
      const s = new TilingSprite({ texture: t, width: W, height: t.height });
      s.y = y;
      this.addChild(s);
      this.layers.push({ s, f });
      return s;
    };
    this.skyBack = add(this.skyOf('human'), 0, 0);
    this.skyTop = add(this.skyOf('human'), 0, 0);
    add(mountains(120, '#58649a', 110, [1, 2, 5]), groundY - 120, 0.1);
    add(mountains(70, '#3f6a5c', 60, [2, 3, 7]), groundY - 70, 0.3);
    add(ground(height - groundY + 4), groundY - 4, 1);
    if (artSet() === 'elthen') void this.loadForest();
  }

  private skyOf(race: string) {
    let t = this.skies.get(race);
    if (!t) this.skies.set(race, t = sky(this.groundY, race));
    return t;
  }

  /** Тон по расе мобов: первый вызов - сразу, дальше небо перетекает за ~1 с, цвета гор/земли/леса - плавно. */
  setRace(race: string, now: number) {
    if (race === this.race || !TONE[race]) return;
    const first = !this.race;
    this.race = race;
    this.to = rgb(TONE[race].tint);
    if (first) this.cur = this.to.slice();
    this.skyBack.texture = first ? this.skyOf(race) : this.skyTop.texture;
    this.skyTop.texture = this.skyOf(race);
    this.skyTop.alpha = first ? 1 : 0;
    this.fadeAt = now;
  }

  update(now: number) {
    const dt = Math.min(100, now - (this.last || now));
    this.last = now;
    if (this.skyTop.alpha < 1) this.skyTop.alpha = Math.min(1, (now - this.fadeAt) / 1000);
    const k = 1 - Math.exp(-dt / 330);
    this.cur = this.cur.map((v, i) => v + (this.to[i] - v) * k);
    const tint = (Math.round(this.cur[0]) << 16) | (Math.round(this.cur[1]) << 8) | Math.round(this.cur[2]);
    this.layers.forEach((l, i) => { if (i > 1) l.s.tint = tint; });
    if (this.forest) this.forest.tint = tint;
  }

  /** Лесной фон Elthen (public/elthen/backdrop.png, не в git): если файла нет - остаётся процедурный. */
  private async loadForest() {
    try {
      const url = `${import.meta.env.BASE_URL}elthen/backdrop.png`;
      if (!(await fetch(url, { method: 'HEAD' })).headers.get('content-type')?.startsWith('image/')) return;
      const t = await Assets.load<Texture>(url);
      t.source.scaleMode = 'nearest';
      this.layers.forEach((l, i) => { if (i > 1) l.s.visible = false; }); // горы и земля кодом уступают лесу
      this.forest = new Sprite(t);
      this.addChildAt(this.forest, 2);
    } catch { /* нет картинки - рисуем кодом */ }
  }
  /** camX — сдвиг мира в логических пикселях (world.x, отрицательный при движении вправо). */
  scroll(camX: number) { for (const l of this.layers) l.s.tilePosition.x = camX * l.f; }
}
