// Сборка отряда из сейва и data — единственное место, где data превращается в статы.
import undead from '../data/heroes/undead.json';
import elf from '../data/heroes/elf.json';
import dwarf from '../data/heroes/dwarf.json';
import human from '../data/heroes/human.json';
import orc from '../data/heroes/orc.json';
import creepsData from '../data/creeps.json';
import economy from '../data/economy.json';
import { creepCap, heroAtk, heroHp } from './economy';
import { partyBonus } from './races';
import { crystalMult } from './prestige';
import { heroArtifactSum } from './artifacts';
import { villageMods } from './buildings';
import type { PartyMember } from './battle';
import type { Ability, CreepType, GameState, Race, Stats } from './types';

export const HEROES = [...undead, ...elf, ...dwarf, ...human, ...orc];
export const heroById = (id: string) => HEROES.find(h => h.id === id);

/** Множитель статов героя от петомца: +5%/ур., сложный процент; артефакты усиливают сам бонус. */
export function petStatMult(petLevel: number, artifactBonus = 0): number {
  if (petLevel <= 0) return 1;
  return 1 + (Math.pow(1 + economy.pets.statPerLevel, petLevel) - 1) * (1 + artifactBonus);
}

export function buildParty(s: GameState): PartyMember[] {
  const ids = s.party.filter(id => s.heroes[id]);
  const races = ids.map(id => heroById(id)!.race as Race);
  const bonus = partyBonus(races);
  const cm = crystalMult(s.crystals);
  const vm = villageMods(s);
  return ids.map(id => {
    const h = heroById(id)!;
    const sv = s.heroes[id];
    const am = heroArtifactSum(s, id);
    const a = (k: string) => am[k] ?? 0;
    const pet = petStatMult(sv.pet, a('pet_stat_mult'));
    // множитель формы — из данных героя
    const form = h.forms[sv.form].statMult;
    const tough = 1 / (1 - Math.min(a('damage_reduction'), 0.9)); // снижение урона ≈ рост эффективного HP
    const stats: Stats = {
      hp: heroHp(h.base.hp, sv.lvl, 0) * form * pet * (1 + a('hero_hp')) * tough,
      atk: heroAtk(h.base.atk, sv.lvl, 0) * form * pet * (1 + a('hero_atk')) * bonus.atkMult * cm,
      atkSpeed: h.base.atkSpeed * (1 + a('hero_atk_speed')), crit: h.base.crit, critDmg: h.base.critDmg + a('crit_dmg'),
      range: h.base.range, moveSpeed: 1.0,
    };
    const cap = creepCap(sv.form, sv.pet, s.village.banner ?? 0, Math.floor(a('creep_cap_add')));
    const lvl = s.village[`barracks_${h.race}`] ?? 0;
    const g = Math.pow(creepsData.levelGrowth, lvl) * bonus.creepMult * cm * (1 + a('creep_all_stats')) * tough;
    const creeps: PartyMember['creeps'] = [];
    const mix = s.creepMix;
    const counts: Record<CreepType, number> = {
      infantry: Math.round(cap * mix.infantry), ranged: Math.round(cap * mix.ranged), healer: 0,
    };
    counts.healer = Math.max(0, cap - counts.infantry - counts.ranged);
    for (const type of ['infantry', 'ranged', 'healer'] as CreepType[]) {
      const t = creepsData.types[type];
      const hpMult = type === 'infantry' ? vm.infantryHp * (1 + a('infantry_hp')) : 1;
      const atkMult = vm.creepAtk * (type === 'infantry' ? 1 + a('infantry_atk') : type === 'ranged' ? 1 + a('ranged_atk') : 1);
      const speed = t.atkSpeed * (type === 'infantry' ? 1 + a('infantry_atk_speed') : 1);
      const crit = type === 'ranged' ? Math.min(1, a('ranged_crit')) : 0;
      for (let i = 0; i < counts[type]; i++) {
        creeps.push({ type, race: h.race as Race, heal: 'heal' in t ? t.heal * g * vm.heal * (1 + a('healer_power')) : undefined,
          stats: { hp: t.hp * g * hpMult, atk: t.atk * g * atkMult, atkSpeed: speed, crit, critDmg: 1.5 + a('crit_dmg'), range: t.range, moveSpeed: t.moveSpeed } });
      }
    }
    const abilities = h.forms.slice(0, sv.form + 1).flatMap(f => f.abilities as unknown as Ability[]);
    if (sv.pet >= 5) abilities.push(h.pet.passive as unknown as Ability);
    return { heroId: id, race: h.race as Race, stats, creeps, abilities };
  });
}

/** Локальная дата YYYY-MM-DD — границы суток для подземелий и дневного корма. */
export function localDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function newGameState(now = Date.now()): GameState {
  return {
    v: 3, savedAt: now, floor: 1, maxFloor: 1, runMaxFloor: 1, gold: String(economy.rewards.startGold), floorPoints: 0, crystals: 0, petFood: 0, gems: 0,
    resources: { bone: 0, leaf: 0, ore: 0, seal: 0, totem: 0 },
    heroes: { alderic: { lvl: 1, form: 0, pet: 0, artifacts: [], floorsInParty: 0 } },
    party: ['alderic'],
    artifacts: {}, perks: { permGold: false, starterPack: false }, dailyFoodDay: '',
    village: {}, base: {},
    creepMix: { infantry: 0.5, ranged: 0.3, healer: 0.2 },
    dungeonRuns: { date: localDate(now) },
    ads: { speedUntil: 0, boostUntil: 0, resourcesToday: 0, gemsToday: 0, day: new Date(now).toISOString().slice(0, 10) },
  };
}
