/** Процедурные пиксельные текстуры юнитов (временный арт). Генерируются один раз, кеш по ключу. */
import { Texture } from 'pixi.js';
import { buildGrid, paletteOf, specKey, type SpriteSpec } from './spriteGrids';

export interface ProcTex { tex: Texture; flash: Texture; w: number; h: number }
const cache = new Map<string, ProcTex>();

function toCanvas(grid: string[][], pal: ReturnType<typeof paletteOf>, white: boolean): HTMLCanvasElement {
  const h = grid.length, w = grid[0].length;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  grid.forEach((row, y) => row.forEach((k, x) => {
    const col = pal[k];
    if (!col) return;
    img.data.set(white && k !== 'H' ? [255, 255, 255, col[3]] : col, (y * w + x) * 4);
  }));
  ctx.putImageData(img, 0, 0);
  return c;
}

function toTexture(grid: string[][], pal: ReturnType<typeof paletteOf>, white: boolean): Texture {
  const tex = Texture.from(toCanvas(grid, pal, white));
  tex.source.scaleMode = 'nearest';
  return tex;
}

export function procSprite(spec: SpriteSpec): ProcTex {
  const key = specKey(spec);
  let t = cache.get(key);
  if (!t) {
    const grid = buildGrid(spec), pal = paletteOf(spec);
    t = { tex: toTexture(grid, pal, false), flash: toTexture(grid, pal, true), w: grid[0].length, h: grid.length };
    cache.set(key, t);
  }
  return t;
}

/** Тот же процедурный спрайт как обычный canvas (для портретов вне PixiJS). */
export function procCanvas(spec: SpriteSpec): HTMLCanvasElement {
  return toCanvas(buildGrid(spec), paletteOf(spec), false);
}
