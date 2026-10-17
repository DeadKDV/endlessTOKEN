import races from '../data/races.json';
import type { Race } from './types';

const ring = races.ring as Race[];

/** Множитель урона атакующего по защищающемуся. */
export function raceMult(attacker: Race, defender: Race): number {
  if (attacker === defender) return races.neutralMult;
  const i = ring.indexOf(attacker);
  const next = ring[(i + 1) % ring.length];
  const prev = ring[(i - 1 + ring.length) % ring.length];
  if (defender === next) return races.advantageMult;
  if (defender === prev) return races.disadvantageMult;
  return races.neutralMult;
}

/** Раса мобов на этаже n: меняется блоками по 5 этажей. */
export function mobRaceForFloor(n: number): Race {
  return ring[Math.floor((n - 1) / races.mobRaceBlockFloors) % ring.length];
}

export function partyBonus(partyRaces: Race[]): { atkMult: number; creepMult: number } {
  const unique = new Set(partyRaces);
  if (partyRaces.length === 5 && unique.size === 1) return { atkMult: races.monoRaceBonus.mult, creepMult: 1 };
  if (partyRaces.length === 5 && unique.size === 5) return { atkMult: 1, creepMult: races.rainbowBonus.mult };
  return { atkMult: 1, creepMult: 1 };
}
