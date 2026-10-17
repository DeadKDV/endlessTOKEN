// Игровой цикл: связывает sim, сейв и рендер. UI подписывается на store.
import { writable, get } from 'svelte/store';
import type { BattleState, GameState } from './sim/types';
import { createBattle, step } from './sim/battle';
import { buildParty } from './sim/party';
import { floorGold, floorPoints, heroLevelCost, goldPerSec } from './sim/economy';
import { computeOffline, estimateFloorSeconds } from './sim/offline';
import { totalFloorHp } from './sim/floor';
import { partyDps } from './sim/battle';
import { loadLocal, saveLocal } from './save/storage';
import economy from './data/economy.json';

export const save = writable<GameState>(loadLocal());
export const battle = writable<BattleState | null>(null);
export const offlinePopup = writable<{ gold: number; seconds: number; capped: boolean } | null>(null);

let acc = 0;
const TICK = economy.tickMs;

export function boot() {
  const s = get(save);
  const p = buildParty(s);
  const off = computeOffline(Date.now(), s.savedAt, s.floor, estimateFloorSeconds(s.floor, partyDps(p), totalFloorHp(s.floor)), s.base.mine ?? 0, s.base.storage ?? 0);
  if (off.gold > 1) { addGold(off.gold); offlinePopup.set(off); }
  startFloor();
  setInterval(() => saveLocal(get(save)), 10_000);
}

export function startFloor() {
  const s = get(save);
  battle.set(createBattle(s.floor, buildParty(s), Date.now() & 0xffffffff));
}

/** Вызывать из requestAnimationFrame с dt в мс. */
export function update(dtMs: number) {
  const s = get(save);
  const speed = Date.now() < s.ads.speedUntil ? economy.ads.speed.mult : 1;
  acc += dtMs * speed;
  const b = get(battle); if (!b) return;
  while (acc >= TICK) {
    acc -= TICK;
    step(b);
    addGold(goldPerSec(s.base.mine ?? 0) * TICK / 1000);
    if (b.finished === 'win') { onFloorWin(b); return; }
    if (b.finished === 'lose') { startFloor(); return; }
  }
  battle.set(b);
}

function onFloorWin(b: BattleState) {
  save.update(s => ({
    ...s,
    gold: (Number(s.gold) + b.goldEarned).toString(),
    floorPoints: s.floorPoints + floorPoints(s.floor),
    floor: s.floor + 1,
    maxFloor: Math.max(s.maxFloor, s.floor + 1),
  }));
  startFloor();
}

export function addGold(n: number) { save.update(s => ({ ...s, gold: (Number(s.gold) + n).toString() })); }

export function levelUpHero(id: string) {
  save.update(s => {
    const h = s.heroes[id]; if (!h) return s;
    const cost = heroLevelCost(h.lvl);
    if (Number(s.gold) < cost) return s;
    return { ...s, gold: (Number(s.gold) - cost).toString(), heroes: { ...s.heroes, [id]: { ...h, lvl: h.lvl + 1 } } };
  });
  startFloor();
}
