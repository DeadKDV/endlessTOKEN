/** Портреты героев для интерфейса: первый кадр idle из того же источника, что и бой (прото → атлас → процедурный). */
import { HEROES } from '../sim/party';
import { procCanvas } from './procSprites';
import { artIndex } from './artSet';
import type { Race, Role } from '../sim/types';

interface SheetData {
  frames: Record<string, { frame: { x: number; y: number; w: number; h: number } }>;
  animations?: Record<string, string[]>;
  meta?: { tint?: number };
}

const cache = new Map<string, Promise<string>>();
const json = new Map<string, Promise<any>>();
const images = new Map<string, Promise<HTMLImageElement>>();
const base = () => import.meta.env.BASE_URL;

const getJson = (url: string) => {
  let p = json.get(url);
  if (!p) json.set(url, p = fetch(url).then(r => { if (!r.ok) throw new Error(url); return r.json(); }));
  return p;
};
const getImage = (url: string) => {
  let p = images.get(url);
  if (!p) images.set(url, p = new Promise((res, rej) => {
    const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error(url)); i.src = url;
  }));
  return p;
};

/** Вырезает кадр и обрезает прозрачные поля, чтобы герой занимал всю рамку. */
function cropToDataUrl(img: CanvasImageSource, x: number, y: number, w: number, h: number, tint?: number): string {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, x, y, w, h, 0, 0, w, h);
  if (tint !== undefined) {
    // перекраска как tint в PixiJS: умножение цвета, прозрачность берём у исходника
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = `#${tint.toString(16).padStart(6, '0')}`;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(img, x, y, w, h, 0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
  }
  const d = ctx.getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (d[(j * w + i) * 4 + 3] > 8) {
    if (i < x0) x0 = i; if (i > x1) x1 = i; if (j < y0) y0 = j; if (j > y1) y1 = j;
  }
  if (x1 < 0) return c.toDataURL();
  const o = document.createElement('canvas'); o.width = x1 - x0 + 1; o.height = y1 - y0 + 1;
  o.getContext('2d')!.drawImage(c, x0, y0, o.width, o.height, 0, 0, o.width, o.height);
  return o.toDataURL();
}

async function fromProto(id: string, form: number): Promise<string> {
  const set = await artIndex();
  if (!set || !set.ids.includes(id)) throw new Error('no proto');
  const data: SheetData = await getJson(`${set.dir}${id}.json`);
  const anim = data.animations?.[`f${form}_idle`] ?? data.animations?.f0_idle;
  const r = anim && data.frames[anim[0]]?.frame;
  if (!r) throw new Error('no frame');
  return cropToDataUrl(await getImage(`${set.dir}${id}.png`), r.x, r.y, r.w, r.h, data.meta?.tint);
}

async function fromAtlas(id: string, form: number): Promise<string> {
  const h = HEROES.find(x => x.id === id)!;
  const races: string[] = (await getJson(`${base()}atlases/index.json`)).races ?? [];
  if (!races.includes(h.race)) throw new Error('no atlas');
  const data: SheetData = await getJson(`${base()}atlases/${h.race}.json`);
  const src = (h.forms[form] ?? h.forms[0]).sprite.split('/').pop()!;
  const r = data.frames[src]?.frame;
  if (!r) throw new Error('no frame');
  return cropToDataUrl(await getImage(`${base()}atlases/${h.race}.png`), r.x, r.y, r.w, r.h);
}

function fromProc(id: string, form: number): string {
  const h = HEROES.find(x => x.id === id)!;
  return procCanvas({ kind: 'hero', race: h.race as Race, enemy: false, role: h.role as Role, form }).toDataURL();
}

/** dataURL портрета героя в форме form (0..2). Не отклоняется: при полном отказе вернёт ''. */
export function heroPortrait(heroId: string, form: number): Promise<string> {
  const key = `${heroId}:${form}`;
  let p = cache.get(key);
  if (!p) {
    p = fromProto(heroId, form)
      .catch(() => fromAtlas(heroId, form))
      .catch(() => fromProc(heroId, form))
      .catch(() => '');
    cache.set(key, p);
  }
  return p;
}
