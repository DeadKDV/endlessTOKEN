// Темп с полной прокачкой: жадный игрок качает героев и здания, призывает героев в открывшиеся слоты,
// кормит петомцев и делает воскрешение, когда упёрся. Запуск: npx vite-node scripts/pacing-full.ts [часов]
import { createBattle, runToEnd } from '../src/sim/battle';
import { buildParty, newGameState, HEROES } from '../src/sim/party';
import { floorPoints, goldPerSec } from '../src/sim/economy';
import { isBossFloor } from '../src/sim/floor';
import { buyHeroLevels, partySlots, summonCost, summonHero, togglePartyMember } from '../src/sim/heroes';
import { buyBuilding } from '../src/sim/buildings';
import { applyPrestige, claimStarterPack, goldMult, prestigeGain } from '../src/sim/prestige';
import { feedPet, onBossCleared } from '../src/sim/pets';
import buildings from '../src/data/buildings.json';
import type { GameState } from '../src/sim/types';

const HOURS = Number(process.argv[2] ?? 12);
let s: GameState = claimStarterPack(newGameState(0));
let sec = 0, sinceBest = 0, prestiges = 0;
const marks = [10, 25, 50, 75, 100, 150, 200];
const log = (m: string) => console.log(`${(sec / 3600).toFixed(2)} ч  ${m}`);

function spend() {
  // призыв в свободные слоты: сначала кристаллами, потом самоцветами
  while (s.party.length < partySlots(s.maxFloor)) {
    const next = HEROES.find(h => !s.heroes[h.id]);
    if (!next) break;
    const before = s;
    s = summonHero(s, next.id, s.crystals >= summonCost(s) ? 'crystals' : 'gems');
    if (s === before || !s.heroes[next.id]) break;
    s = togglePartyMember(s, next.id);
    log(`призван ${next.id}, в отряде ${s.party.length}`);
  }
  for (const id of Object.keys(s.heroes)) for (let i = 0; i < 30; i++) { const b = s; s = feedPet(s, id); if (b === s) break; }
  // здания: все, что по карману, по одному уровню за проход, пока что-то покупается
  for (let bought = true; bought;) {
    bought = false;
    for (const b of buildings as { id: string }[]) { const was = s; s = buyBuilding(s, b.id, 1); if (was !== s) bought = true; }
  }
  // золото - в героев отряда по кругу
  for (let bought = true; bought;) {
    bought = false;
    for (const id of s.party) { const was = s; s = buyHeroLevels(s, id, 1); if (was !== s) bought = true; }
  }
}

while (sec < HOURS * 3600) {
  const r = runToEnd(createBattle(s.floor, buildParty(s), sec | 0), 3000);
  const dt = r.ticks / 10;
  sec += dt; sinceBest += dt;
  const gold = r.gold * goldMult(s) + goldPerSec(s.base.mine ?? 0) * goldMult(s) * dt;
  s = { ...s, gold: String(Number(s.gold) + gold) };
  if (r.result === 'win') {
    if (isBossFloor(s.floor)) s = onBossCleared(s, s.floor).state;
    const f = s.floor + 1;
    s = { ...s, floorPoints: s.floorPoints + floorPoints(s.floor), floor: f, runMaxFloor: Math.max(s.runMaxFloor, f) };
    if (f > s.runMaxFloor - 1) sinceBest = 0;
    if (f > s.maxFloor) {
      s = { ...s, maxFloor: f };
      while (marks.length && f >= marks[0]) log(`этаж ${marks.shift()}`);
    }
  } else s = { ...s, floor: Math.max(1, s.floor - 1) };
  spend();
  // воскрешение, когда забег упёрся: полчаса без нового этажа в этом забеге
  // 'smart' (3-й аргумент): воскрешаться, когда новые кристаллы заметно больше накопленных
  const smart = process.argv[3] === 'smart' && prestigeGain(s) >= Math.max(20, s.crystals * 1.5);
  if ((sinceBest > 1800 || smart) && prestigeGain(s) > 0) {
    prestiges++;
    log(`воскрешение №${prestiges} с этажа ${s.runMaxFloor}: +${prestigeGain(s)} кристаллов`);
    s = applyPrestige(s); sinceBest = 0;
  }
}
console.log(JSON.stringify({ heroes: Object.fromEntries(Object.entries(s.heroes).map(([k, h]) => [k, [h.lvl, h.form, h.pet]])), village: s.village, base: s.base, gold: Number(s.gold).toExponential(2), fp: s.floorPoints }));
log(`итог: лучший этаж ${s.maxFloor}, воскрешений ${prestiges}, героев ${Object.keys(s.heroes).length}`);
