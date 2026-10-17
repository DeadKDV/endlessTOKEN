// Замер баланса: до какого этажа доходит отряд при заданном уровне героев без прочей прокачки.
// Запуск: npx vite-node scripts/balance.ts
import { createBattle, runToEnd } from '../src/sim/battle';
import { buildParty, newGameState } from '../src/sim/party';

function maxFloor(lvl: number, heroes: string[] = ['alderic'], cap = 400): number {
  const s = newGameState(0);
  s.heroes = {}; s.party = heroes;
  for (const id of heroes) s.heroes[id] = { lvl, form: 0, pet: 0, artifacts: [], floorsInParty: 0 };
  const p = buildParty(s);
  for (let f = 1; f <= cap; f++) {
    if (runToEnd(createBattle(f, p, 1), 6000).result !== 'win') return f - 1;
  }
  return cap;
}

for (const lvl of [1, 5, 10, 20, 30, 50]) console.log(`ур.${lvl}: один герой до этажа ${maxFloor(lvl)}`);
