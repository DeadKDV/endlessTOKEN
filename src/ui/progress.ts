// Чистые помощники интерфейса: прогресс до босса и отметки «есть что купить» на вкладках.
import economy from '../data/economy.json';
import type { GameState } from '../sim/types';
import { BUILDINGS, buyBuilding } from '../sim/buildings';
import { buyHeroLevels } from '../sim/heroes';
import { DUNGEONS, dungeonUnlocked, runsLeft } from '../sim/dungeons';

/** Сколько этажей до босса; 0 — текущий этаж боссовый. */
export const floorsToBoss = (floor: number) => (economy.floor.bossEvery - (floor % economy.floor.bossEvery)) % economy.floor.bossEvery;

export type Tab = 'battle' | 'heroes' | 'village' | 'base' | 'dungeons' | 'guild' | 'shop';

/** Есть ли на вкладке доступная покупка: считается теми же функциями, что и сама покупка. */
export function tabHasPurchase(s: GameState, tab: Tab, nowMs: number, inDungeon = false): boolean {
  switch (tab) {
    case 'heroes': return s.party.some(id => buyHeroLevels(s, id, 1) !== s);
    case 'village': case 'base': return BUILDINGS.some(b => b.zone === tab && buyBuilding(s, b.id, 1) !== s);
    case 'dungeons': return !inDungeon && DUNGEONS.some(d => dungeonUnlocked(s, d.id) && runsLeft(s, d.id, nowMs) > 0);
    case 'shop': return !s.perks.starterPack;
    default: return false;
  }
}
