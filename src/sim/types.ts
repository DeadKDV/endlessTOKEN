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

/** Свой генератор волн (подземелья): волна w (1-based) со стартом в x. Без него — обычный этаж. */
export type WaveGen = (wave: number, startX: number) => Unit[];

export interface BattleState {
  floor: number;
  wave: number;
  tick: number;
  units: Unit[];
  seed: number;
  rngState: number;
  goldEarned: number;
  finished: null | 'win' | 'lose';
  waveGen?: WaveGen;
}

/** pet: 0 = петомца нет, >=1 — его уровень. floorsInParty — этажей пройдено с героем в отряде (для пробуждения). */
export interface HeroSave { lvl: number; form: 0 | 1 | 2; pet: number; artifacts: string[]; floorsInParty: number }

export interface GameState {
  v: number;
  savedAt: number;
  floor: number;
  maxFloor: number;
  runMaxFloor: number;     // макс. этаж текущего забега: от него кристаллы престижа
  gold: string;            // Decimal как строка
  floorPoints: number;
  crystals: number;
  petFood: number;
  gems: number;
  resources: Record<'bone' | 'leaf' | 'ore' | 'seal' | 'totem', number>;
  heroes: Record<string, HeroSave>;
  party: string[];
  artifacts: Record<string, number>; // купленные артефакты → уровень 1..50
  perks: { permGold: boolean };      // разовые покупки за самоцветы
  dailyFoodDay: string;              // дата последнего забранного дневного корма
  village: Record<string, number>;
  base: Record<string, number>;
  creepMix: Record<CreepType, number>;
  dungeonRuns: { date: string; [dungeon: string]: string | number };
  ads: { speedUntil: number; boostUntil: number; resourcesToday: number; gemsToday: number; day: string };
}
