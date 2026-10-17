// Чистые типы симуляции. Никаких импортов из render/ или ui/.
export type Race = 'undead' | 'elf' | 'dwarf' | 'human' | 'orc';
export type Role = 'tank' | 'fighter' | 'ranger' | 'mage' | 'support';
export type CreepType = 'infantry' | 'ranged' | 'healer';
export type Side = 'party' | 'enemy';

export interface Stats {
  hp: number;
  atk: number;
  atkSpeed: number; // атак в секунду
  crit: number;     // 0..1
  critDmg: number;  // множитель
  range: number;    // клетки
  moveSpeed: number; // клетки/сек
}

/** Способность из data/heroes/*.json. Набор полей зависит от kind (см. schema.md). */
export interface Ability {
  id: string;
  name?: { ru: string; en: string };
  kind: string;
  value?: number;
  duration?: number;
  cooldown?: number;
  targets?: number;
  radius?: number;
  stat?: string;
  cap?: number;
  hits?: number;
  ignoreArmor?: boolean;
  count?: number;
  hp?: number;
  root?: number;
  stun?: number;
  critFar?: boolean;
  selfHeal?: number;
  hpThreshold?: number;
  cost?: number;
}

/** Временный эффект на юните; until — тик, до которого (не включая) он действует. */
export interface Effect { k: string; v: number; until: number; src?: string }

export interface Zone { x: number; radius: number; dmg: number; side: Side; src: number; until: number; next: number }

export interface Unit {
  id: number;
  side: Side;
  race: Race;
  kind: 'hero' | 'creep' | 'mob' | 'boss' | 'base';
  refId: string;      // id героя/крипа/моба из data
  x: number;          // позиция по горизонтали (клетки), отряд идёт вправо
  hp: number;
  maxHp: number;
  stats: Stats;
  attackCooldown: number; // сек до следующей атаки
  healPower?: number;
  alive: boolean;
  abilities?: Ability[];
  cds?: number[];          // тики до готовности каждой способности
  effects?: Effect[];
  shield?: number;
  shieldUntil?: number;
  stacks?: number;         // stack_atk
  doubleCast?: boolean;
  revived?: boolean;
  recalled?: boolean;
  temp?: boolean;          // призванный/скелет/дух: не воскрешается и не считается крипом отряда
  expireTick?: number;
}

export interface BattleState {
  floor: number;
  wave: number;
  tick: number;
  units: Unit[];
  seed: number;
  rngState: number;
  goldEarned: number;
  finished: null | 'win' | 'lose';
  zones?: Zone[];
  goldMult?: number;
}

export interface HeroSave { lvl: number; form: 0 | 1 | 2; pet: number; artifacts: string[] }

export interface GameState {
  v: number;
  savedAt: number;
  floor: number;
  maxFloor: number;
  gold: string;            // Decimal как строка
  floorPoints: number;
  crystals: number;
  petFood: number;
  gems: number;
  resources: Record<'bone' | 'leaf' | 'ore' | 'seal' | 'totem', number>;
  heroes: Record<string, HeroSave>;
  party: string[];
  village: Record<string, number>;
  base: Record<string, number>;
  creepMix: Record<CreepType, number>;
  dungeonRuns: { date: string; [dungeon: string]: string | number };
  ads: { speedUntil: number; boostUntil: number; resourcesToday: number; gemsToday: number; day: string };
}
