import { describe, it, expect } from 'vitest';
import type { GameState } from '../src/sim/types';
import LZString from 'lz-string';
import { newGameState, buildParty, petStatMult } from '../src/sim/party';
import { buildingById, buildingUpgradeCost, buyBuilding, villageMods, affordable, dungeonUnlockLevel } from '../src/sim/buildings';
import { feedCost, feedPet, onBossCleared, eggRecipient, claimDailyFood, dailyFoodAmount } from '../src/sim/pets';
import { canAwaken, awaken, canUnite, unite } from '../src/sim/forms';
import {
  DUNGEON_MAX_TICKS, createDungeonBattle, dungeonReward, dungeonUnlocked, grantDungeonReward,
  normalizeRuns, resetRuns, runsLeft, spendRun, stepDungeon,
} from '../src/sim/dungeons';
import {
  artifactById, artifactSlots, artifactUpgradeCost, artifactValue, buyArtifact, equipArtifact, heroArtifactSum, upgradeArtifact,
} from '../src/sim/artifacts';
import { buyHeroLevels, partySlots, setCreepMix, summonCost, summonHero, togglePartyMember } from '../src/sim/heroes';
import { applyPrestige, prestigeGain, goldMult, buyPermGold, claimStarterPack } from '../src/sim/prestige';
import economy from '../src/data/economy.json';
import { deserialize, migrate, serialize } from '../src/save/storage';

const mk = () => newGameState(0);

describe('здания', () => {
  it('стоимость уровня: costBase × growth^L, округление вверх', () => {
    const b = buildingById('barracks_undead')!;
    expect(buildingUpgradeCost(b, 0)).toBe(10);
    expect(buildingUpgradeCost(b, 5)).toBe(Math.ceil(10 * Math.pow(1.12, 5)));
    expect(buildingUpgradeCost(buildingById('portal')!, 2)).toBe(Math.ceil(500 * 1.44));
  });
  it('покупка списывает очки этажа и поднимает уровень в нужной зоне', () => {
    const s = { ...mk(), floorPoints: 1000 };
    const r = buyBuilding(s, 'mine');
    expect(r.base.mine).toBe(1);
    expect(r.floorPoints).toBe(1000 - 20);
    expect(buyBuilding(s, 'range').village.range).toBe(1);
  });
  it('не хватает очков — состояние то же; ×10 и ×max считают сумму', () => {
    const s = mk();
    expect(buyBuilding(s, 'mine')).toBe(s);
    const b = buildingById('barracks_elf')!;
    const sum10 = Array.from({ length: 10 }, (_, L) => buildingUpgradeCost(b, L)).reduce((a, c) => a + c, 0);
    const r = buyBuilding({ ...s, floorPoints: sum10 }, 'barracks_elf', 10);
    expect(r.village.barracks_elf).toBe(10);
    expect(r.floorPoints).toBe(0);
    const m = buyBuilding({ ...s, floorPoints: sum10 + 1 }, 'barracks_elf', 'max');
    expect(m.village.barracks_elf).toBeGreaterThanOrEqual(10);
  });
  it('maxLevel не превышается', () => {
    expect(affordable(() => 1, 98, 100, 1e9, 'max')).toEqual({ n: 2, cost: 2 });
  });
  it('Полигон и Лазарет усиливают крипов в buildParty', () => {
    const base = buildParty(mk())[0].creeps;
    const s = { ...mk(), village: { range: 10, infirmary: 10 } };
    expect(villageMods(s)).toEqual({ creepAtk: 1.2, heal: 1.3, infantryHp: 1.4 });
    const up = buildParty(s)[0].creeps;
    const inf = (c: typeof base) => c.find(x => x.type === 'infantry')!;
    expect(inf(up).stats.atk / inf(base).stats.atk).toBeCloseTo(1.2);
    expect(inf(up).stats.hp / inf(base).stats.hp).toBeCloseTo(1.4);
    const heal = (c: typeof base) => c.find(x => x.type === 'healer')!.heal!;
    expect(heal(up) / heal(base)).toBeCloseTo(1.3);
  });
  it('Казармы расы героя качают уровень крипов ×1.06, Знамёнщик добавляет крипов', () => {
    const a = buildParty(mk())[0]; // alderic — человек
    const s = { ...mk(), village: { barracks_human: 10, banner: 50 } };
    const b = buildParty(s)[0];
    expect(b.creeps[0].stats.hp / a.creeps[0].stats.hp).toBeCloseTo(Math.pow(1.06, 10));
    expect(b.creeps.length).toBe(a.creeps.length + 2);
  });
  it('Портал открывает подземелья на 1/10/25/50/100', () => {
    expect(['crypt', 'grove', 'mine', 'citadel', 'arena'].map(dungeonUnlockLevel)).toEqual([1, 10, 25, 50, 100]);
  });
});

describe('петомцы', () => {
  it('корм на уровень L+1 = 5·(L+1)²', () => {
    expect(feedCost(1)).toBe(20);
    expect(feedCost(9)).toBe(500);
  });
  it('кормление: тратит корм, ограничено 30 уровнем и наличием петомца', () => {
    const s = mk(); s.petFood = 100; s.heroes.alderic.pet = 1;
    const r = feedPet(s, 'alderic');
    expect(r.heroes.alderic.pet).toBe(2);
    expect(r.petFood).toBe(80);
    expect(feedPet({ ...s, heroes: { alderic: { ...s.heroes.alderic, pet: 0 } } }, 'alderic').heroes.alderic.pet).toBe(0);
    expect(feedPet({ ...s, petFood: 1e9, heroes: { alderic: { ...s.heroes.alderic, pet: 30 } } }, 'alderic').heroes.alderic.pet).toBe(30);
    expect(feedPet({ ...s, petFood: 19 }, 'alderic').heroes.alderic.pet).toBe(1);
  });
  it('+5% статов за уровень и +1 крип каждые 5 уровней', () => {
    expect(petStatMult(0)).toBe(1);
    expect(petStatMult(2)).toBeCloseTo(1.05 * 1.05);
    expect(petStatMult(2, 1)).toBeCloseTo(1 + 2 * (1.05 * 1.05 - 1));
    const s = mk(); s.heroes.alderic.pet = 10;
    expect(buildParty(s)[0].creeps.length).toBe(4 + 2);
  });
  it('яйцо: босс 10-го этажа впервые; порядок — по отряду, потом остальные герои', () => {
    const s = mk();
    s.heroes.groul = { lvl: 1, form: 0, pet: 0, artifacts: [], floorsInParty: 0 };
    s.heroes.alderic.pet = 3; s.maxFloor = 10; s.floor = 10;
    expect(eggRecipient(s)).toBe('groul');
    const r = onBossCleared(s, 10);
    expect(r.egg).toBe('groul');
    expect(r.state.heroes.groul.pet).toBe(1);
    expect(r.state.petFood).toBe(5);
    expect(r.state.crystals).toBe(s.crystals + 1); // первое прохождение 10-го: 10 / 10
    // повторное прохождение — только корм
    const again = onBossCleared({ ...s, maxFloor: 20 }, 10);
    expect(again.egg).toBeNull();
    expect(again.state.petFood).toBe(5);
    expect(again.state.crystals).toBe(s.crystals);
    expect(onBossCleared(s, 7).state).toBe(s);
  });
  it('дневной корм раз в сутки, Псарня +1 за 5 уровней', () => {
    const s = { ...mk(), base: { kennel: 10 } };
    expect(dailyFoodAmount(s)).toBe(5 + 2);
    const r = claimDailyFood(s, '2026-10-17');
    expect(r.petFood).toBe(7);
    expect(claimDailyFood(r, '2026-10-17')).toBe(r);
    expect(claimDailyFood(r, '2026-10-18').petFood).toBe(14);
  });
});

describe('формы', () => {
  it('пробуждение: 50 этажей в отряде и 500 очков этажа', () => {
    const s = mk();
    expect(canAwaken(s, 'alderic')).toBe(false);
    s.heroes.alderic.floorsInParty = 49; s.floorPoints = 500;
    expect(canAwaken(s, 'alderic')).toBe(false);
    s.heroes.alderic.floorsInParty = 50;
    expect(canAwaken({ ...s, floorPoints: 499 }, 'alderic')).toBe(false);
    const r = awaken(s, 'alderic');
    expect(r.heroes.alderic.form).toBe(1);
    expect(r.floorPoints).toBe(0);
    expect(awaken(r, 'alderic')).toBe(r);
  });
  it('союз: пробуждён и петомец 10 ур.', () => {
    const s = mk(); s.heroes.alderic.form = 1; s.heroes.alderic.pet = 9;
    expect(canUnite(s, 'alderic')).toBe(false);
    s.heroes.alderic.pet = 10;
    expect(unite(s, 'alderic').heroes.alderic.form).toBe(2);
    expect(canUnite(mk(), 'alderic')).toBe(false);
  });
  it('множитель формы берётся из данных героя: 1.8 / 3.2', () => {
    const hp = (f: 0 | 1 | 2) => { const s = mk(); s.heroes.alderic.form = f; return buildParty(s)[0].stats.hp; };
    expect(hp(1) / hp(0)).toBeCloseTo(1.8);
    expect(hp(2) / hp(0)).toBeCloseTo(3.2);
  });
});

describe('подземелья', () => {
  const day1 = new Date(2026, 9, 17, 23, 59).getTime();
  const day2 = new Date(2026, 9, 18, 0, 0).getTime();
  const open = (): GameState => ({ ...newGameState(day1), base: { portal: 100 } });
  it('открытие по уровню портала', () => {
    const s = { ...mk(), base: { portal: 10 } };
    expect(dungeonUnlocked(s, 'crypt')).toBe(true);
    expect(dungeonUnlocked(s, 'grove')).toBe(true);
    expect(dungeonUnlocked(s, 'mine')).toBe(false);
    expect(dungeonUnlocked(mk(), 'crypt')).toBe(false);
    expect(spendRun(mk(), 'crypt', 0)).toEqual(mk());
  });
  it('3 входа в день, сброс в локальную полночь', () => {
    let s = open();
    expect(runsLeft(s, 'crypt', day1)).toBe(3);
    for (let i = 0; i < 3; i++) s = spendRun(s, 'crypt', day1);
    expect(runsLeft(s, 'crypt', day1)).toBe(0);
    expect(spendRun(s, 'crypt', day1)).toBe(s);
    expect(runsLeft(s, 'grove', day1)).toBe(3);
    expect(runsLeft(s, 'crypt', day2)).toBe(3);
    expect(normalizeRuns(s.dungeonRuns, day2).crypt).toBeUndefined();
    expect(spendRun(s, 'crypt', day2).dungeonRuns.crypt).toBe(1);
  });
  it('сброс входов за 50 самоцветов', () => {
    let s = open(); s = spendRun(s, 'crypt', day1);
    expect(resetRuns(s, day1)).toBe(s);
    const r = resetRuns({ ...s, gems: 60 }, day1);
    expect(r.gems).toBe(10);
    expect(runsLeft(r, 'crypt', day1)).toBe(3);
  });
  it('бой 60 с: волны расы подземелья, ресурс = выбитые волны × 10', () => {
    const s = mk(); s.heroes.alderic.lvl = 60;
    const b = createDungeonBattle(s, 'grove', buildParty(s), 1);
    expect(b.units.filter(u => u.side === 'enemy').every(u => u.race === 'elf')).toBe(true);
    while (!b.finished) stepDungeon(b);
    expect(b.tick).toBeLessThanOrEqual(DUNGEON_MAX_TICKS);
    expect(DUNGEON_MAX_TICKS).toBe(600);
    const waves = dungeonReward(b);
    expect(waves).toBe((b.wave - 1) * 10);
    expect(waves).toBeGreaterThan(0);
    expect(grantDungeonReward(s, 'grove', waves).resources.leaf).toBe(waves);
  });
  it('слабый отряд проигрывает, но получает за уже выбитые волны', () => {
    const s = mk(); s.runMaxFloor = 100;
    const b = createDungeonBattle(s, 'crypt', buildParty(s), 1);
    while (!b.finished) stepDungeon(b);
    expect(b.finished).toBe('lose');
    expect(dungeonReward(b)).toBe(0);
  });
});

describe('артефакты', () => {
  const a = artifactById('skull_lich')!; // 0.10 → 5.0
  it('линейная интерполяция по уровню 1..50', () => {
    expect(artifactValue(a, 1)).toBeCloseTo(0.1);
    expect(artifactValue(a, 50)).toBeCloseTo(5.0);
    expect(artifactValue(a, 25)).toBeCloseTo(0.1 + (5.0 - 0.1) * 24 / 49);
    expect(artifactValue(a, 99)).toBeCloseTo(5.0);
    expect(artifactValue(a, 0)).toBe(0);
  });
  it('покупка за 100 ресурса ветки, улучшение ×1.5 за уровень', () => {
    expect(artifactUpgradeCost(1)).toBe(150);
    expect(artifactUpgradeCost(2)).toBe(225);
    const s = mk(); s.resources.bone = 100;
    const b = buyArtifact(s, 'skull_lich');
    expect(b.artifacts.skull_lich).toBe(1);
    expect(b.resources.bone).toBe(0);
    expect(buyArtifact(b, 'skull_lich')).toBe(b);
    expect(buyArtifact({ ...s, resources: { ...s.resources, bone: 99 } }, 'skull_lich').artifacts.skull_lich).toBeUndefined();
    expect(buyArtifact({ ...s, resources: { ...s.resources, bone: 0, leaf: 500 } }, 'skull_lich').artifacts.skull_lich).toBeUndefined();
    const u = upgradeArtifact({ ...b, resources: { ...b.resources, bone: 150 } }, 'skull_lich');
    expect(u.artifacts.skull_lich).toBe(2);
    expect(u.resources.bone).toBe(0);
    expect(upgradeArtifact({ ...b, artifacts: { skull_lich: 50 }, resources: { ...b.resources, bone: 1e9 } }, 'skull_lich').artifacts.skull_lich).toBe(50);
  });
  it('слоты открываются на 50/100/150 уровне героя', () => {
    expect([1, 49, 50, 99, 100, 149, 150, 400].map(artifactSlots)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
  });
  it('надевание требует слот; артефакт у одного владельца; эффект влияет на статы', () => {
    const s = mk(); s.artifacts = { skull_lich: 1, star_plate: 1 };
    expect(equipArtifact(s, 'alderic', 'skull_lich')).toBe(s);
    s.heroes.alderic.lvl = 50;
    const e = equipArtifact(s, 'alderic', 'skull_lich');
    expect(e.heroes.alderic.artifacts).toEqual(['skull_lich']);
    expect(equipArtifact(e, 'alderic', 'star_plate')).toBe(e); // слот один
    expect(heroArtifactSum(e, 'alderic').hero_atk).toBeCloseTo(0.1);
    expect(buildParty(e)[0].stats.atk / buildParty(s)[0].stats.atk).toBeCloseTo(1.1);
    const own = { ...e, heroes: { ...e.heroes, groul: { lvl: 50, form: 0 as const, pet: 0, artifacts: [], floorsInParty: 0 } } };
    const moved = equipArtifact(own, 'groul', 'skull_lich');
    expect(moved.heroes.alderic.artifacts).toEqual([]);
    expect(moved.heroes.groul.artifacts).toEqual(['skull_lich']);
  });
});

describe('герои и отряд', () => {
  it('уровни за золото ×1/×10/×max', () => {
    const s = { ...mk(), gold: '100000' };
    expect(buyHeroLevels(s, 'alderic').heroes.alderic.lvl).toBe(2);
    expect(buyHeroLevels(s, 'alderic', 10).heroes.alderic.lvl).toBe(11);
    const m = buyHeroLevels(s, 'alderic', 'max');
    expect(m.heroes.alderic.lvl).toBeGreaterThan(11);
    expect(Number(m.gold)).toBeLessThan(15 * Math.pow(1.09, m.heroes.alderic.lvl - 1));
    expect(buyHeroLevels(mk(), 'alderic')).toEqual(mk());
  });
  it('слоты отряда: 1/10/25/50/100 этажи', () => {
    expect([1, 9, 10, 24, 25, 49, 50, 99, 100].map(partySlots)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5]);
  });
  it('состав отряда ограничен слотами; последнего героя убрать нельзя', () => {
    let s = mk();
    s.heroes.groul = { lvl: 1, form: 0, pet: 0, artifacts: [], floorsInParty: 0 };
    expect(togglePartyMember(s, 'groul')).toBe(s);
    s = { ...s, maxFloor: 10 };
    s = togglePartyMember(s, 'groul');
    expect(s.party).toEqual(['alderic', 'groul']);
    s = togglePartyMember(s, 'alderic');
    expect(s.party).toEqual(['groul']);
    expect(togglePartyMember(s, 'groul')).toBe(s);
  });
  it('призыв: кристаллы по растущей цене или 300 самоцветов, нельзя дважды', () => {
    const s = { ...mk(), crystals: 50, gems: 300 };
    expect(summonCost(s)).toBe(5); // один герой - первый призыв дешёвый
    const r = summonHero(s, 'groul');
    expect(r.crystals).toBe(45);
    expect(summonCost(r)).toBe(8); // 5 × 1.5, округлено
    expect(r.heroes.groul).toEqual({ lvl: 1, form: 0, pet: 0, artifacts: [], floorsInParty: 0 });
    expect(summonHero(r, 'groul')).toBe(r);
    expect(summonHero({ ...s, crystals: 4 }, 'groul')).toEqual({ ...s, crystals: 4 });
    expect(summonHero(s, 'groul', 'gems').gems).toBe(0);
    expect(summonHero(s, 'nobody')).toBe(s);
  });
  it('слайдеры крипов дают сумму 1', () => {
    const s = setCreepMix(mk(), 'infantry', 0.8);
    expect(s.creepMix.infantry).toBe(0.8);
    expect(s.creepMix.ranged).toBeCloseTo(0.2);
    expect(s.creepMix.healer).toBeCloseTo(0);
    const t = setCreepMix(s, 'ranged', 0.1);
    expect(t.creepMix.infantry + t.creepMix.ranged + t.creepMix.healer).toBeCloseTo(1);
  });
});

describe('престиж', () => {
  it('сбрасывает этаж, золото, уровни; оставляет деревню, базу, петомцев, формы, артефакты, ресурсы', () => {
    const s = mk();
    Object.assign(s, {
      floor: 80, maxFloor: 80, runMaxFloor: 80, gold: '1e9', floorPoints: 55, petFood: 7, gems: 4,
      village: { range: 3 }, base: { tavern: 10 }, artifacts: { skull_lich: 5 }, resources: { ...s.resources, bone: 12 },
    });
    s.heroes.alderic = { lvl: 120, form: 2, pet: 12, artifacts: ['skull_lich'], floorsInParty: 77 };
    const gain = prestigeGain(s);
    expect(gain).toBe(Math.floor(Math.floor(3 * Math.pow(8, 1.5)) * 1.2));
    const r = applyPrestige(s);
    expect(r.floor).toBe(1); expect(r.runMaxFloor).toBe(1); expect(r.gold).toBe('0');
    expect(r.crystals).toBe(gain);
    expect(r.heroes.alderic).toEqual({ lvl: 1, form: 2, pet: 12, artifacts: ['skull_lich'], floorsInParty: 77 });
    expect(r.maxFloor).toBe(80);
    expect(r.village).toEqual({ range: 3 }); expect(r.base).toEqual({ tavern: 10 });
    expect(r.artifacts).toEqual({ skull_lich: 5 });
    expect(r.floorPoints).toBe(55); expect(r.petFood).toBe(7); expect(r.gems).toBe(4); expect(r.resources.bone).toBe(12);
  });
  it('без прогресса забега (<10 этажа) кристаллов нет — состояние не меняется', () => {
    const s = mk();
    expect(applyPrestige(s)).toBe(s);
  });
  it('кристаллы считаются по этажу забега, а не по рекорду', () => {
    const s = { ...mk(), maxFloor: 100, runMaxFloor: 10 };
    expect(prestigeGain(s)).toBe(3); // floor(3 · 1^1.5), по забегу, а не по рекорду
  });
});

describe('миграция сейва', () => {
  it('v1 → v2: поля добавлены, прогресс сохранён', () => {
    const v1 = {
      v: 1, savedAt: 5, floor: 30, maxFloor: 42, gold: '10', floorPoints: 9, crystals: 3, petFood: 0, gems: 0,
      resources: { bone: 1, leaf: 0, ore: 0, seal: 0, totem: 0 },
      heroes: { alderic: { lvl: 7, form: 1, pet: 2, artifacts: [] } }, party: ['alderic'],
      village: { range: 1 }, base: {}, creepMix: { infantry: 0.5, ranged: 0.3, healer: 0.2 },
      dungeonRuns: { date: '2026-10-17' }, ads: { speedUntil: 0, boostUntil: 0, resourcesToday: 0, gemsToday: 0, day: '2026-10-17' },
    };
    const s = deserialize(LZString.compressToBase64(JSON.stringify(v1)));
    expect(s.v).toBe(5);
    expect(s.autoAdvance).toBe(true);
    expect(s.runMaxFloor).toBe(42);
    expect(s.artifacts).toEqual({});
    expect(s.perks).toEqual({ permGold: false, starterPack: false });
    expect(s.heroes.alderic).toEqual({ lvl: 7, form: 1, pet: 2, artifacts: [], floorsInParty: 0 });
    expect(s.village).toEqual({ range: 1 });
    expect(s.floor).toBe(30);
    expect(buildParty(s).length).toBe(1);
  });
  it('v2 → v3: отметка стартового набора, прогресс сохранён', () => {
    const { v, perks, ...rest } = mk();
    const v2 = { ...rest, v: 2, perks: { permGold: true }, gems: 7 };
    const s = deserialize(LZString.compressToBase64(JSON.stringify(v2)));
    expect(s.v).toBe(5);
    expect(s.perks).toEqual({ permGold: true, starterPack: false });
    expect(s.gems).toBe(7);
  });
  it('v3 → v4: авто-проход включён, остальное сохранено', () => {
    const s = deserialize(LZString.compressToBase64(JSON.stringify({ ...mk(), v: 3, floor: 17 })));
    expect(s.v).toBe(5); expect(s.autoAdvance).toBe(true); expect(s.floor).toBe(17);
  });
  it('v5 не трогается, выключенный авто-проход переживает сериализацию', () => {
    const s = migrate(mk());
    expect(deserialize(LZString.compressToBase64(JSON.stringify(s)))).toEqual(s);
    const off = { ...s, autoAdvance: false };
    expect(deserialize(serialize(off)).autoAdvance).toBe(false);
  });
});

describe('золото и магазин', () => {
  it('множитель золота: кристаллы, артефакт, вечная покупка', () => {
    const s = mk();
    expect(goldMult(s)).toBe(1);
    s.crystals = 10; s.artifacts = { royal_seal: 1 }; s.heroes.alderic.lvl = 50; s.heroes.alderic.artifacts = ['royal_seal'];
    expect(goldMult(s)).toBeCloseTo(1.2 * 1.1);
    expect(goldMult({ ...s, perks: { permGold: true, starterPack: false } })).toBeCloseTo(1.2 * 1.1 * 1.1);
  });
  it('вечный ×1.1 за 1000 самоцветов — один раз', () => {
    const s = { ...mk(), gems: 1500 };
    const r = buyPermGold(s);
    expect(r.gems).toBe(500); expect(r.perks.permGold).toBe(true);
    expect(buyPermGold({ ...r, gems: 5000 })).toEqual({ ...r, gems: 5000 });
    expect(buyPermGold({ ...s, gems: 999 }).perks.permGold).toBe(false);
  });
});

describe('стартовый набор', () => {
  it('бесплатно и один раз: самоцветы, золото, корм', () => {
    const s = { ...mk(), gems: 5, gold: '10', petFood: 1 };
    const p = economy.gems.starterPack;
    const r = claimStarterPack(s);
    expect(r.gems).toBe(5 + p.gems); expect(Number(r.gold)).toBe(10 + p.gold); expect(r.petFood).toBe(1 + p.petFood);
    expect(r.perks.starterPack).toBe(true);
    expect(claimStarterPack(r)).toBe(r);
  });
  it('переживает сериализацию: повторно не выдаётся', () => {
    const r = deserialize(serialize(claimStarterPack(mk())));
    expect(claimStarterPack(r)).toBe(r);
  });
});

describe('словари', () => {
  it('ru и en содержат одинаковые ключи', async () => {
    const ru = (await import('../src/data/i18n/ru.json')).default; const en = (await import('../src/data/i18n/en.json')).default;
    const keys = (o: any, p = ''): string[] => Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' ? keys(v, p + k + '.') : [p + k]));
    expect(keys(ru).sort()).toEqual(keys(en).sort());
  });
});
