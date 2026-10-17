/** Задник кодом: небо-градиент полосами, два слоя гор и земля с травой/камнями. Параллакс через tilePosition. */
import { Container, TilingSprite, Texture } from 'pixi.js';

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

function sky(h: number): Texture {
  return canvasTex(W, h, c => {
    const top = [18, 22, 52], low = [214, 138, 112];
    const bands = 28;
    for (let b = 0; b < bands; b++) {
      c.fillStyle = mix(top, low, b / (bands - 1));
      c.fillRect(0, Math.floor(b * h / bands), W, Math.ceil(h / bands));
    }
    for (let i = 0; i < 40; i++) { c.fillStyle = 'rgba(255,255,255,0.8)'; c.fillRect(Math.floor(rnd() * W), Math.floor(rnd() * h * 0.5), 1, 1); }
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
  constructor(groundY: number, height: number) {
    super();
    const add = (t: Texture, y: number, f: number) => {
      const s = new TilingSprite({ texture: t, width: W, height: t.height });
      s.y = y;
      this.addChild(s);
      this.layers.push({ s, f });
    };
    add(sky(groundY), 0, 0);
    add(mountains(120, '#2a2f55', 110, [1, 2, 5]), groundY - 120, 0.1);
    add(mountains(70, '#1d3a3a', 60, [2, 3, 7]), groundY - 70, 0.3);
    add(ground(height - groundY + 4), groundY - 4, 1);
  }
  /** camX — сдвиг мира в логических пикселях (world.x, отрицательный при движении вправо). */
  scroll(camX: number) { for (const l of this.layers) l.s.tilePosition.x = camX * l.f; }
}
