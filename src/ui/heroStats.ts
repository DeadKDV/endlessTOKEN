// Статы героя для карточки: считает buildParty (единственное место формул), без дублирования.
import { buildParty } from '../sim/party';
import type { GameState, Stats } from '../sim/types';

const statsOf = (s: GameState, id: string): Stats => buildParty(s).find(m => m.heroId === id)!.stats;

/** Текущие статы героя и множитель к «голому» герою того же уровня (форма 0, без петомца и артефактов). */
export function heroStatView(s: GameState, id: string) {
  const inParty = s.party.includes(id);
  const cur: GameState = inParty ? s : { ...s, party: [id] }; // бонус расы зависит от состава отряда
  const stats = statsOf(cur, id);
  const bare = statsOf({ ...cur, heroes: { ...cur.heroes, [id]: { ...cur.heroes[id], form: 0, pet: 0, artifacts: [] } } }, id);
  return { stats, mult: { hp: stats.hp / bare.hp, atk: stats.atk / bare.atk, atkSpeed: stats.atkSpeed / bare.atkSpeed } };
}
