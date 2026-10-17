// Игровой цикл: связывает sim, сейв и рендер. UI подписывается на store.
import { writable, get } from 'svelte/store';
import type { BattleState, GameState } from './sim/types';
import { createBattle, step, partyDps } from './sim/battle';
import { buildParty, localDate } from './sim/party';
import { floorPoints, goldPerSec } from './sim/economy';
import { computeOffline, estimateFloorSeconds } from './sim/offline';
import { totalFloorHp, isBossFloor } from './sim/floor';
import { partyArtifactSum } from './sim/artifacts';
import { buyBuilding, buildingById } from './sim/buildings';
import { buyHeroLevels, movePartyMember, setCreepMix, summonHero, togglePartyMember } from './sim/heroes';
import { claimDailyFood, feedPet, onBossCleared } from './sim/pets';
import { awaken, unite } from './sim/forms';
import { buyArtifact, equipArtifact, unequipArtifact, upgradeArtifact } from './sim/artifacts';
import { applyPrestige, buyPermGold, claimStarterPack, goldMult } from './sim/prestige';
import {
  createDungeonBattle, dungeonReward, dungeonUnlocked, grantDungeonReward, resetRuns, runsLeft, spendRun, stepDungeon,
} from './sim/dungeons';
import { loadLocal, saveLocal } from './save/storage';
import { autoAdvanceOn } from './save/autoAdvance';
import { t, tpl } from './ui/text';
import economy from './data/economy.json';

export const save = writable<GameState>(loadLocal());
export const battle = writable<BattleState | null>(null);
export const offlinePopup = writable<{ gold: number; seconds: number; capped: boolean } | null>(null);
/** Герой, получивший яйцо петомца (попап). */
export const eggPopup = writable<string | null>(null);
/** Идущий бой в подземелье (на той же сцене) и его итог. */
/** Герой, чья полноэкранная карточка открыта. */
export const heroCard = writable<string | null>(null);
/** Окно подтверждения воскрешения. */
export const prestigeAsk = writable(false);
/** Герой, только что призванный (попап-раскрытие). */
export const summonReveal = writable<string | null>(null);
export const dungeonRun = writable<string | null>(null);
export const dungeonResult = writable<{ id: string; waves: number; amount: number } | null>(null);

/** Короткое всплывающее сообщение (id растёт, чтобы повтор того же текста показывался заново). */
export const toast = writable<{ id: number; text: string } | null>(null);
let toastId = 0;
export function showToast(text: string) { toast.set({ id: ++toastId, text }); }

let acc = 0;
const TICK = economy.tickMs;

export function boot() {
  const s = get(save);
  const p = buildParty(s);
  const rate = goldMult(s) * (1 + partyArtifactSum(s, 'offline_rate'));
  const off = computeOffline(Date.now(), s.savedAt, s.floor, estimateFloorSeconds(s.floor, partyDps(p), totalFloorHp(s.floor)), s.base.mine ?? 0, s.base.storage ?? 0, rate);
  if (off.gold > 1) { addGold(off.gold); offlinePopup.set(off); }
  startFloor();
  setInterval(() => saveLocal(get(save)), 10_000);
}

export function startFloor() {
  if (get(dungeonRun)) return; // во время подземелья обычный этаж не перезапускаем
  const s = get(save);
  battle.set(createBattle(s.floor, buildParty(s), Date.now() & 0xffffffff));
}

/** Вызывать из requestAnimationFrame с dt в мс. */
export function update(dtMs: number) {
  const s = get(save);
  const speed = Date.now() < s.ads.speedUntil ? economy.ads.speed.mult : 1;
  acc += dtMs * speed;
  const b = get(battle); if (!b) return;
  const dungeon = get(dungeonRun);
  while (acc >= TICK) {
    acc -= TICK;
    if (dungeon) stepDungeon(b); else step(b);
    addGold(goldPerSec(s.base.mine ?? 0) * goldMult(s) * TICK / 1000);
    if (dungeon && b.finished) { finishDungeon(dungeon, b); return; }
    if (b.finished === 'win') { onFloorWin(b); return; }
    if (b.finished === 'lose') { onFloorLose(b); return; }
  }
  battle.set(b);
}

/** Поражение, как в Endless Frontier: золото за убитых остаётся, отряд откатывается на этаж назад и фармит. */
function onFloorLose(b: BattleState) {
  const to = Math.max(1, get(save).floor - 1);
  save.update(s => ({
    ...s,
    gold: (Number(s.gold) + b.goldEarned * goldMult(s)).toString(),
    floor: to,
  }));
  showToast(tpl(t.progress.rollback, { n: to }));
  startFloor();
}

function onFloorWin(b: BattleState) {
  if (!autoAdvanceOn(get(save))) { // «Остаться на этаже»: только золото, этаж повторяется
    save.update(s => ({ ...s, gold: (Number(s.gold) + b.goldEarned * goldMult(s)).toString() }));
    startFloor();
    return;
  }
  const got: { egg: string | null } = { egg: null };
  save.update(s => {
    let n: GameState = { ...s, heroes: { ...s.heroes } };
    for (const id of s.party) if (n.heroes[id]) n.heroes[id] = { ...n.heroes[id], floorsInParty: n.heroes[id].floorsInParty + 1 };
    if (isBossFloor(s.floor)) { const r = onBossCleared(n, s.floor); n = r.state; got.egg = r.egg; }
    const fp = Math.floor(floorPoints(s.floor) * (1 + partyArtifactSum(s, 'floor_points_mult')));
    return {
      ...n,
      gold: (Number(s.gold) + b.goldEarned * goldMult(s)).toString(),
      floorPoints: s.floorPoints + fp,
      floor: s.floor + 1,
      maxFloor: Math.max(s.maxFloor, s.floor + 1),
      runMaxFloor: Math.max(s.runMaxFloor, s.floor + 1),
    };
  });
  if (got.egg) eggPopup.set(got.egg);
  startFloor();
}

function finishDungeon(id: string, b: BattleState) {
  const amount = dungeonReward(b);
  save.update(s => grantDungeonReward(s, id, amount));
  dungeonResult.set({ id, waves: b.wave - 1, amount });
  dungeonRun.set(null);
  startFloor();
}

export function addGold(n: number) { save.update(s => ({ ...s, gold: (Number(s.gold) + n).toString() })); }

/** Применить чистое действие sim к сейву; restart — перезапустить этаж, если поменялись статы отряда. */
function act(fn: (s: GameState) => GameState, restart = false) {
  const before = get(save);
  const after = fn(before);
  if (after === before) return;
  save.set(after);
  if (restart) startFloor();
}

export const levelUpHero = (id: string, count: number | 'max' = 1) => act(s => buyHeroLevels(s, id, count), true);
export const buyBuildingAction = (id: string, count: number | 'max' = 1) =>
  act(s => buyBuilding(s, id, count), buildingById(id)?.zone === 'village');
export const feedPetAction = (id: string) => act(s => feedPet(s, id), true);
export const awakenHero = (id: string) => act(s => awaken(s, id), true);
export const uniteHero = (id: string) => act(s => unite(s, id), true);
export const buyArtifactAction = (id: string) => act(s => buyArtifact(s, id));
export const upgradeArtifactAction = (id: string) => act(s => upgradeArtifact(s, id), true);
export const equipArtifactAction = (hero: string, id: string) => act(s => equipArtifact(s, hero, id), true);
export const unequipArtifactAction = (hero: string, id: string) => act(s => unequipArtifact(s, hero, id), true);
export function summonHeroAction(id: string, pay: 'crystals' | 'gems' = 'crystals') {
  const had = !!get(save).heroes[id];
  act(s => summonHero(s, id, pay));
  if (!had && get(save).heroes[id]) summonReveal.set(id);
}
export const claimStarterPackAction = () => act(claimStarterPack);
export const togglePartyAction = (id: string) => act(s => togglePartyMember(s, id), true);
export const movePartyAction = (id: string, dir: -1 | 1) => act(s => movePartyMember(s, id, dir), true);
export const setCreepMixAction = (type: 'infantry' | 'ranged', v: number) => act(s => setCreepMix(s, type, v), true);
export const claimFood = () => act(s => claimDailyFood(s, localDate(Date.now())));
export const resetDungeonRuns = () => act(s => resetRuns(s, Date.now()));
export const toggleAutoAdvance = () => act(s => ({ ...s, autoAdvance: !autoAdvanceOn(s) }));
export const buyPermGoldAction = () => act(buyPermGold);

/** Воскрешение: сброс этажа, золота и уровней героев. Во время подземелья недоступно. */
export function prestige() {
  if (get(dungeonRun)) return;
  act(applyPrestige, true);
}

/** Войти в подземелье: списывает вход и запускает 60-секундный бой на той же сцене. */
export function enterDungeon(id: string) {
  const s = get(save); const now = Date.now();
  if (get(dungeonRun) || !dungeonUnlocked(s, id) || runsLeft(s, id, now) <= 0) return;
  save.set(spendRun(s, id, now));
  dungeonRun.set(id);
  battle.set(createDungeonBattle(s, id, buildParty(s), now & 0xffffffff));
}
