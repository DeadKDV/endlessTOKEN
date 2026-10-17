// Сборка отряда из сейва и data — единственное место, где data превращается в статы.
import undead from '../data/heroes/undead.json';
import elf from '../data/heroes/elf.json';
import dwarf from '../data/heroes/dwarf.json';
import human from '../data/heroes/human.json';
import orc from '../data/heroes/orc.json';
import creepsData from '../data/creeps.json';
import { creepCap, heroAtk, heroHp } from './economy';
import { partyBonus } from './races';
import { crystalMult } from './prestige';
import type { PartyMember } from './battle';
import type { Ability, CreepType, GameState, Race, Stats } from './types';

export const HEROES = [...undead, ...elf, ...dwarf, ...human, ...orc];
export const heroById = (id: string) => HEROES.find(h => h.id === id);

export function buildParty(s: GameState): PartyMember[] {
  const ids = s.party.filter(id => s.heroes[id]);
  const races = ids.map(id => heroById(id)!.race as Race);
  const bonus = partyBonus(races);
  const cm = crystalMult(s.crystals);
  return ids.map(id => {
    const h = heroById(id)!;
    const sv = s.heroes[id];
    const stats: Stats = {
      hp: heroHp(h.base.hp, sv.lvl, sv.form, sv.pet),
      atk: heroAtk(h.base.atk, sv.lvl, sv.form, sv.pet) * bonus.atkMult * cm,
      atkSpeed: h.base.atkSpeed, crit: h.base.crit, critDmg: h.base.critDmg, range: h.base.range, moveSpeed: 1.0,
    };
    const cap = creepCap(sv.form, sv.pet, s.village.banner ?? 0);
    const lvl = s.village[`barracks_${h.race}`] ?? 0;
    const g = Math.pow(creepsData.levelGrowth, lvl) * bonus.creepMult * cm;
    const creeps: PartyMember['creeps'] = [];
    const mix = s.creepMix;
    const counts: Record<CreepType, number> = {
      infantry: Math.round(cap * mix.infantry), ranged: Math.round(cap * mix.ranged), healer: 0,
    };
    counts.healer = Math.max(0, cap - counts.infantry - counts.ranged);
    for (const type of ['infantry', 'ranged', 'healer'] as CreepType[]) {
      const t = creepsData.types[type];
      for (let i = 0; i < counts[type]; i++) {
        creeps.push({ type, race: h.race as Race, heal: 'heal' in t ? t.heal * g : undefined,
          stats: { hp: t.hp * g, atk: t.atk * g, atkSpeed: t.atkSpeed, crit: 0, critDmg: 1.5, range: t.range, moveSpeed: t.moveSpeed } });
      }
    }
    const abilities = h.forms.slice(0, sv.form + 1).flatMap(f => f.abilities as unknown as Ability[]);
    if (sv.pet >= 5) abilities.push(h.pet.passive as unknown as Ability);
    return { heroId: id, race: h.race as Race, stats, creeps, abilities };
  });
}

export function newGameState(now = Date.now()): GameState {
  return {
    v: 1, savedAt: now, floor: 1, maxFloor: 1, gold: '0', floorPoints: 0, crystals: 0, petFood: 0, gems: 0,
    resources: { bone: 0, leaf: 0, ore: 0, seal: 0, totem: 0 },
    heroes: { alderic: { lvl: 1, form: 0, pet: 0, artifacts: [] } },
    party: ['alderic'],
    village: {}, base: {},
    creepMix: { infantry: 0.5, ranged: 0.3, healer: 0.2 },
    dungeonRuns: { date: new Date(now).toISOString().slice(0, 10) },
    ads: { speedUntil: 0, boostUntil: 0, resourcesToday: 0, gemsToday: 0, day: new Date(now).toISOString().slice(0, 10) },
  };
}
