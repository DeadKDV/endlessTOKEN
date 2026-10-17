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
  dungeonRuns: { date: string } & Partial<Record<string, number>>;
  ads: { speedUntil: number; boostUntil: number; resourcesToday: number; gemsToday: number; day: string };
}
