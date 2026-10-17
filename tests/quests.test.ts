import { describe, it, expect } from 'vitest';
import LZString from 'lz-string';
import { newGameState, localDate } from '../src/sim/party';
import {
  achievements, chestReady, claimAchievement, claimChest, claimDaily, dailyQuests, generateDaily, questsClaimable, recordEvent, syncQuests,
} from '../src/sim/quests';
import { deserialize, migrate } from '../src/save/storage';

const D1 = new Date(2026, 9, 17, 12).getTime();
const D2 = new Date(2026, 9, 18, 0, 5).getTime();
const mk = () => migrate(newGameState(D1));
const finishAll = (s: ReturnType<typeof mk>, now: number) => recordEvent(s, now, { floorsCleared: 99, bossesKilled: 99, levelsBought: 999, buildingLevels: 99, adsWatched: 9, dungeonsRun: 9 });

describe('ежедневные задания', () => {
  it('генерация детерминирована по дате: 5 разных видов; без портала нет подземелья', () => {
    expect(generateDaily('2026-10-17', true)).toEqual(generateDaily('2026-10-17', true));
    for (const d of ['2026-10-17', '2026-10-18', '2026-12-01']) {
      const ids = generateDaily(d, false);
      expect(ids.length).toBe(5);
      expect(new Set(ids.map(x => x.split(':')[0])).size).toBe(5);
      expect(ids.some(x => x.startsWith('dungeons'))).toBe(false);
    }
    expect(new Set(['2026-10-17', '2026-10-18', '2026-10-19', '2026-10-20', '2026-10-21'].map(d => generateDaily(d, true).join())).size).toBeGreaterThan(1);
  });
  it('сброс по дате: прогресс и забранное обнуляются, накопленная статистика остаётся', () => {
    let s = finishAll(mk(), D1);
    const id = dailyQuests(s)[0].id;
    s = claimDaily(s, D1, id);
    expect(s.quests!.dailyClaimed).toEqual([id]);
    const n = syncQuests(s, D2);
    expect(n.quests!.day).toBe(localDate(D2));
    expect(n.quests!.dailyClaimed).toEqual([]);
    expect(dailyQuests(n).every(q => q.progress === 0)).toBe(true);
    expect(n.quests!.stats.floorsCleared).toBe(99);
    expect(syncQuests(n, D2)).toBe(n);
  });
  it('засчитывание: прогресс растёт и ограничен целью, награда только при выполнении', () => {
    let s = syncQuests(mk(), D1);
    const q0 = dailyQuests(s)[0];
    expect(claimDaily(s, D1, q0.id)).toBe(s);
    s = recordEvent(s, D1, { floorsCleared: 3, bossesKilled: 1, levelsBought: 5, buildingLevels: 2, adsWatched: 1 });
    const q = dailyQuests(s).find(x => x.kind === 'floors');
    if (q) expect(q.progress).toBe(Math.min(3, q.target));
    s = finishAll(s, D1);
    expect(dailyQuests(s).every(x => x.done && x.progress === x.target)).toBe(true);
  });
  it('награда выдаётся один раз; сундук только после всех пяти', () => {
    let s = finishAll(syncQuests({ ...mk(), gold: '0', gems: 0, petFood: 0 }, D1), D1);
    const qs = dailyQuests(s);
    expect(chestReady(s)).toBe(false);
    expect(claimChest(s, D1)).toBe(s);
    for (const q of qs.slice(0, 4)) s = claimDaily(s, D1, q.id);
    expect(chestReady(s)).toBe(false);
    s = claimDaily(s, D1, qs[4].id);
    const again = claimDaily(s, D1, qs[4].id);
    expect(again).toBe(s);
    const g = s.gems, pf = s.petFood, gold = Number(s.gold);
    expect(g + pf).toBeGreaterThan(0); expect(gold).toBeGreaterThan(0);
    expect(chestReady(s)).toBe(true);
    const c = claimChest(s, D1);
    expect(c.gems).toBe(g + 30);
    expect(claimChest(c, D1)).toBe(c);
  });
});

describe('достижения', () => {
  it('ступени: награда растёт, забирается один раз, следующая ступень открывается позже', () => {
    let s = { ...mk(), maxFloor: 30, gems: 0 };
    let a = achievements(s).find(x => x.id === 'maxFloor')!;
    expect(a.ready).toBe(2); expect(a.nextTarget).toBe(10);
    s = claimAchievement(s, 'maxFloor');
    expect(s.gems).toBe(10 + 20);
    expect(claimAchievement(s, 'maxFloor')).toBe(s);
    a = achievements(s).find(x => x.id === 'maxFloor')!;
    expect(a.ready).toBe(0); expect(a.claimed).toBe(2); expect(a.nextTarget).toBe(50);
    s = { ...s, maxFloor: 50 };
    expect(achievements(s).find(x => x.id === 'maxFloor')!.ready).toBe(1);
    expect(claimAchievement(s, 'maxFloor').gems).toBe(30 + 30);
  });
  it('счётчики и герои считаются; отметка «есть награда»', () => {
    let s = mk();
    expect(questsClaimable(s, D1)).toBe(false);
    s = recordEvent(s, D1, { prestiges: 1 });
    expect(achievements(s).find(x => x.id === 'prestiges')!.ready).toBe(1);
    expect(questsClaimable(s, D1)).toBe(true);
    expect(achievements(s).find(x => x.id === 'heroes')!.value).toBe(Object.keys(s.heroes).length);
  });
});

describe('сейв v5', () => {
  it('миграция v4 → v5: quests добавлены, остальное цело', () => {
    const v4 = { ...newGameState(D1), v: 4, autoAdvance: false, floor: 21, gems: 7 };
    const s = deserialize(LZString.compressToBase64(JSON.stringify(v4)));
    expect(s.v).toBe(6);
    expect(s.floor).toBe(21); expect(s.gems).toBe(7); expect(s.autoAdvance).toBe(false);
    expect(s.quests!.stats.floorsCleared).toBe(0);
    expect(s.quests!.ach).toEqual({});
  });
  it('v5 переживает сериализацию без потерь', () => {
    const s = recordEvent(mk(), D1, { floorsCleared: 4 });
    expect(deserialize(LZString.compressToBase64(JSON.stringify(s)))).toEqual(s);
  });
});
