/** Ленивый кеш покадровых атласов: при старте только index.json, атлас юнита грузится при первой просьбе и больше не запрашивается. */
import { Spritesheet, Texture } from 'pixi.js';
import { artIndex } from './artSet';

export interface Proto { sheet: Spritesheet; anchors: Record<string, [number, number]>; charH: Record<string, number>; projectile?: 'arrow' | 'bullet' | 'cannon' | 'orb' | 'heal'; tint?: number }

const json = new Map<string, Promise<any>>();
const images = new Map<string, Promise<HTMLImageElement>>();
const protos = new Map<string, Promise<Proto | null>>();
const ready = new Map<string, Proto>();

export const getJson = (url: string) => {
  let p = json.get(url);
  if (!p) json.set(url, p = fetch(url).then(r => { if (!r.ok) throw new Error(url); return r.json(); }));
  return p;
};
export const getImage = (url: string) => {
  let p = images.get(url);
  if (!p) images.set(url, p = new Promise((res, rej) => {
    const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error(url)); i.src = url;
  }));
  return p;
};

/** Уже загруженный атлас или undefined (синхронно, для кадра отрисовки). */
export const peekProto = (id: string) => ready.get(id);

/** Запрос атласа; повторные вызовы дают тот же промис. null - набора/юнита нет. */
export function loadProto(id: string): Promise<Proto | null> {
  let p = protos.get(id);
  if (!p) protos.set(id, p = (async () => {
    const set = await artIndex();
    if (!set || !set.ids.includes(id)) return null;
    try {
      const [img, data] = await Promise.all([getImage(`${set.dir}${id}.png`), getJson(`${set.dir}${id}.json`)]);
      const texture = Texture.from(img);
      texture.source.scaleMode = 'nearest';
      const sheet = new Spritesheet(texture, data);
      await sheet.parse();
      const pr: Proto = { sheet, anchors: data.meta.anchors, charH: data.meta.charH, projectile: data.meta.projectile, tint: data.meta.tint };
      ready.set(id, pr);
      return pr;
    } catch (e) {
      console.warn(`прото-атлас ${id} не загружен`, e);
      return null;
    }
  })());
  return p;
}
