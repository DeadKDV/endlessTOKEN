/** Тик боя. Детерминирован: одинаковые входы + seed → одинаковый исход (нужно для сервера). Способности — в abilities.ts. */
import economy from '../data/economy.json';
import { mulberry32 } from './rng';
import { spawnWave, spawnBase, newId, resetIds } from './floor';
import { floorGold } from './economy';
import { applyAbilities, initAbilities, pickTarget, basicAttack, atkSpeedOf, rangeOf, moveSpeedOf, isStunned } from './abilities';
import type { BattleState, Unit, Race, Stats, CreepType, Ability, WaveGen } from './types';

const DT = economy.tickMs / 1000;
const WAVES = economy.floor.wavesPerFloor;
const PARTY_START_X = 0;
const ENEMY_START_X = 10;
/** Где стоит вражеская база (клетки). Рендер прижимает её к правому краю экрана. */
export const BASE_X = 14;
/** Откуда выходят волны обычного этажа - от базы. */
const WAVE_X = BASE_X - 1;

export interface PartyMember {
  heroId: string; race: Race; stats: Stats;
  creeps: { type: CreepType; race: Race; stats: Stats; heal?: number }[];
  abilities: Ability[];
}

export function createBattle(floor: number, party: PartyMember[], seed: number, waveGen?: WaveGen): BattleState {
  resetIds();
  const units: Unit[] = [];
  party.forEach((m, i) => {
    const hero = mkUnit('party', m.race, 'hero', m.heroId, PARTY_START_X - i * 0.5, m.stats);
    hero.abilities = m.abilities;
    hero.cds = m.abilities.map(() => 0);
    units.push(hero);
    m.creeps.forEach((c, j) => {
      const off = c.type === 'infantry' ? 0.8 : c.type === 'ranged' ? -1.0 : -1.5;
      const u = mkUnit('party', c.race, 'creep', `${c.race}_${c.type}`, PARTY_START_X + off - j * 0.3 - i * 0.5, c.stats);
      u.healPower = c.heal;
      units.push(u);
    });
  });
  const s: BattleState = { floor, wave: 1, tick: 0, units, seed, rngState: seed, goldEarned: 0, finished: null, waveGen };
  if (waveGen) s.units.push(...waveGen(1, ENEMY_START_X));
  else s.units.push(spawnBase(floor, BASE_X), ...spawnWave(floor, 1, WAVE_X));
  initAbilities(s);
  return s;
}

function mkUnit(side: Unit['side'], race: Race, kind: Unit['kind'], refId: string, x: number, stats: Stats): Unit {
  return { id: newId(), side, race, kind, refId, x, hp: stats.hp, maxHp: stats.hp, stats, attackCooldown: 0, alive: true };
}

/** Один тик (100 мс). Мутирует state для скорости; снаружи считать его непрозрачным. */
export function step(s: BattleState): BattleState {
  if (s.finished) return s;
  const rnd = mulberry32(s.rngState + s.tick);
  const party = s.units.filter(u => u.alive && u.side === 'party');
  const enemy = s.units.filter(u => u.alive && u.side === 'enemy');
  if (party.length === 0) { s.finished = 'lose'; return s; }
  const waveLeft = enemy.some(u => u.kind !== 'base');
  if (enemy.length === 0 && !s.waveGen && s.wave >= WAVES) {
    s.goldEarned += floorGold(s.floor) * 0.4 * (s.goldMult ?? 1);
    s.finished = 'win';
    return s;
  }
  if (!waveLeft) {
    if (s.waveGen || s.wave < WAVES) {
      s.wave++;
      if (s.waveGen) s.units.push(...s.waveGen(s.wave, Math.max(...party.map(u => u.x)) + ENEMY_START_X));
      else s.units.push(...spawnWave(s.floor, s.wave, WAVE_X));
      s.tick++;
      return s;
    }
    // волны выбиты - база открыта
    s.baseOpen = true;
  }
  applyAbilities(s, rnd);
  for (const u of s.units) {
    if (!u.alive) continue;
    if (isStunned(u, s.tick)) { u.attackCooldown -= DT; continue; }
    const foes = u.side === 'party' ? (s.baseOpen ? enemy : enemy.filter(e => e.kind !== 'base')) : party;
    const target = pickTarget(s, u, foes);
    if (!target) { u.attackCooldown -= DT; continue; }
    const dist = Math.abs(target.x - u.x);
    // хилер: лечит союзника с наименьшим % HP вместо атаки
    if (u.healPower && u.attackCooldown <= 0) {
      const allies = (u.side === 'party' ? party : enemy).filter(a => a.alive && a.hp < a.maxHp);
      if (allies.length) {
        const low = allies.reduce((a, b) => (a.hp / a.maxHp < b.hp / b.maxHp ? a : b));
        low.hp = Math.min(low.maxHp, low.hp + u.healPower);
        u.attackCooldown = 1 / atkSpeedOf(u, s.tick);
      }
    }
    if (dist > rangeOf(u, s.tick)) {
      const sp = moveSpeedOf(u, s.tick);
      if (sp > 0) u.x += Math.sign(target.x - u.x) * sp * DT;
    } else if (u.attackCooldown <= 0 && !u.healPower) {
      basicAttack(s, u, target, rnd);
      u.attackCooldown = 1 / atkSpeedOf(u, s.tick);
    }
    u.attackCooldown -= DT;
  }
  s.tick++;
  return s;
}

/** Прогнать бой до конца или до maxTicks. Возвращает итог — то, что клиент шлёт серверу. */
export function runToEnd(s: BattleState, maxTicks = 20_000): { result: BattleState['finished']; ticks: number; gold: number } {
  while (!s.finished && s.tick < maxTicks) step(s);
  return { result: s.finished ?? 'lose', ticks: s.tick, gold: s.goldEarned };
}

/** DPS отряда — для оценок оффлайна и HP рейд-босса. */
export function partyDps(party: PartyMember[]): number {
  let dps = 0;
  for (const m of party) {
    dps += m.stats.atk * m.stats.atkSpeed * (1 + m.stats.crit * (m.stats.critDmg - 1));
    for (const c of m.creeps) if (!c.heal) dps += c.stats.atk * c.stats.atkSpeed;
  }
  return dps;
}
