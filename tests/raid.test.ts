import { describe, it, expect } from 'vitest';
import LZString from 'lz-string';
import { newGameState, buildParty } from '../src/sim/party';
import { partyDps } from '../src/sim/battle';
import {
  RAID_MAX_TICKS, createRaidBattle, raidDamage, raidEntriesLeft, raidRace, raidRewardOf, raidTierOf, raidTiers, raidToday, settleRaid, spendRaidEntry, stepRaid,
} from '../src/sim/raid';
import { dailyQuests, recordEvent, syncQuests } from '../src/sim/quests';
import { deserialize, migrate } from '../src/save/storage';
import economy from '../src/data/economy.json';

const D1 = new Date(2026, 9, 17, 12).getTime();
const D2 = new Date(2026, 9, 18, 0, 5).getTime();
const mk = () => { const s = migrate(newGameState(D1)); s.runMaxFloor = 20; s.heroes.alderic.lvl = 30; return s; };
const fight = (s = mk(), now = D1) => {
  const b = createRaidBattle(s, buildParty(s), 1, now);
  while (!b.finished) stepRaid(b);
  return b;
};

describe('рейд дня', () => {
  it('раса босса зависит только от даты и не повторяется два дня подряд', () => {
    expect(raidRace('2026-10-17')).toBe(raidRace('2026-10-17'));
    for (let d = 1; d < 30; d++) expect(raidRace(`2026-10-${String(d).padStart(2, '0')}`)).not.toBe(raidRace(`2026-10-${String(d + 1).padStart(2, '0')}`));
    expect(new Set(Array.from({ length: 5 }, (_, i) => raidRace(`2026-11-0${i + 1}`))).size).toBe(5);
  });
  it('бой детерминирован, длится 60 с, босс не умирает; урон = потеря HP босса', () => {
    const a = fight(), b = fight();
    expect(raidDamage(a)).toBe(raidDamage(b));
    expect(a.tick).toBeLessThanOrEqual(RAID_MAX_TICKS);
    expect(RAID_MAX_TICKS).toBe(600);
    const boss = a.units.find(u => u.refId === 'raid_boss')!;
    expect(boss.alive).toBe(true);
    expect(raidDamage(a)).toBeGreaterThan(0);
    expect(raidDamage(a)).toBe(boss.maxHp - boss.hp);
    expect(boss.maxHp).toBe(partyDps(buildParty(mk())) * economy.guild.raid.hpDpsMult * economy.guild.raid.hpSeconds);
    expect(boss.race).toBe(raidRace('2026-10-17'));
  });
  it('3 захода в день, сброс в локальную полночь; рекорд остаётся, дневной лучший - нет', () => {
    let s = mk();
    expect(raidEntriesLeft(s, D1)).toBe(3);
    for (let i = 0; i < 3; i++) s = spendRaidEntry(s, D1);
    expect(raidEntriesLeft(s, D1)).toBe(0);
    expect(spendRaidEntry(s, D1)).toBe(s);
    s = settleRaid(s, 500, [100], D1)!.state;
    expect(raidEntriesLeft(s, D2)).toBe(3);
    expect(raidToday(s, D2).best).toBe(0);
    expect(raidToday(s, D2).record).toBe(500);
    expect(spendRaidEntry(s, D2).raid!.used).toBe(1);
  });
  it('ступени от DPS отряда и растут с силой', () => {
    const s = mk(); const t1 = raidTiers(buildParty(s));
    expect(t1.length).toBe(5);
    expect(t1).toEqual([...t1].sort((x, y) => x - y));
    const strong = mk(); strong.heroes.alderic.lvl = 60;
    expect(raidTiers(buildParty(strong))[0]).toBeGreaterThan(t1[0]);
    expect(raidTierOf(0, t1)).toBe(0);
    expect(raidTierOf(t1[1], t1)).toBe(2);
    expect(raidTierOf(t1[4] * 10, t1)).toBe(5);
    expect(raidRewardOf(0)).toEqual({});
    expect(raidRewardOf(5).crystals).toBeGreaterThan(0);
  });
  it('награда выдаётся один раз за заход; рекорд обновляется только при превышении', () => {
    const tiers = [100, 200, 300, 400, 500];
    let s = { ...spendRaidEntry({ ...mk(), gems: 0, petFood: 0, crystals: 0 }, D1) };
    const r = settleRaid(s, 250, tiers, D1)!;
    expect(r.result).toMatchObject({ damage: 250, tier: 2, newRecord: true, reward: economy.guild.raid.rewards[1] });
    expect(r.state.gems).toBe(5); expect(r.state.petFood).toBe(10);
    expect(settleRaid(r.state, 250, tiers, D1)).toBeNull();
    s = spendRaidEntry(r.state, D1);
    const r2 = settleRaid(s, 150, tiers, D1)!;
    expect(r2.result.newRecord).toBe(false);
    expect(r2.state.raid).toMatchObject({ best: 250, record: 250, pending: false });
    const r3 = settleRaid(spendRaidEntry(r2.state, D1), 99, tiers, D1)!;
    expect(r3.result.tier).toBe(0); expect(r3.state.gems).toBe(r2.state.gems);
  });
  it('бой даёт ступень не ниже первой для обычного отряда', () => {
    const s = mk(); const b = fight(s);
    expect(raidTierOf(raidDamage(b), raidTiers(buildParty(s)))).toBeGreaterThanOrEqual(1);
  });
  it('задание «Сходить в рейд» считается', () => {
    const s = recordEvent(syncQuests(mk(), D1), D1, { raidsRun: 1 });
    expect(s.quests!.dayStats.raidsRun).toBe(1);
    expect(dailyQuests(s).every(q => Number.isFinite(q.progress))).toBe(true);
  });
  it('миграция v6 → v7: raid добавлен, счётчик заданий raidsRun = 0, остальное цело', () => {
    const { raid: _r, ...rest } = newGameState(D1);
    const v6 = { ...rest, v: 6, floor: 33, gems: 4, quests: { stats: { floorsCleared: 5 }, day: '2026-10-17', dayStats: { floorsCleared: 2 }, daily: [], dailyClaimed: [], chestClaimed: false, ach: {} } };
    const s = deserialize(LZString.compressToBase64(JSON.stringify(v6)));
    expect(s.v).toBe(7);
    expect(s.floor).toBe(33); expect(s.gems).toBe(4);
    expect(s.raid).toEqual({ date: '', used: 0, best: 0, record: 0, pending: false });
    expect(s.quests!.stats).toEqual({ floorsCleared: 5, raidsRun: 0 });
    expect(raidEntriesLeft(s, D1)).toBe(3);
  });
});
