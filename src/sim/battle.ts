/** Тик боя. Детерминирован: одинаковые входы + seed → одинаковый исход (нужно для сервера). Способности — в abilities.ts. */
import economy from '../data/economy.json';
import { mulberry32 } from './rng';
import { spawnWave, spawnBase, newId, resetIds } from './floor';
import { floorGold } from './economy';
import { applyAbilities, initAbilities, pickTarget, basicAttack, atkSpeedOf, rangeOf, moveSpeedOf, isStunned } from './abilities';
import type { BattleState, Unit, Race, Stats, CreepType, Ability, WaveGen } from './types';

const DT = economy.tickMs / 1000;
const B = economy.battle;
const ticks = (sec: number) => Math.round(sec * 1000 / economy.tickMs);
const WAVES = economy.floor.wavesPerFloor;
const PARTY_START_X = 0;
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
  // подземелье: без баз, но волны выходят из той же точки справа - экран неподвижный
  if (waveGen) s.units.push(...waveGen(1, WAVE_X));
  else {
    // Как в Endless Frontier: у каждой стороны база, юниты выходят из неё по очереди.
    const heroHp = units.filter(u => u.kind === 'hero').reduce((a, u) => a + u.maxHp, 0);
    const own = mkUnit('party', party[0]?.race ?? 'human', 'base', 'party_base', B.partyBaseX,
      { hp: Math.max(1, heroHp) * B.partyBaseHpMult, atk: 0, atkSpeed: 0, crit: 0, critDmg: 1, range: 0, moveSpeed: 0 });
    // герои первыми, затем крипы
    const order = [...units.filter(u => u.kind === 'hero'), ...units.filter(u => u.kind !== 'hero')];
    order.forEach((u, i) => queue(u, i * ticks(B.spawnGapSec)));
    s.units.unshift(own);
    s.units.push(spawnBase(floor, BASE_X), ...stagger(spawnWave(floor, 1, WAVE_X), 0));
    s.nextWaveAt = ticks(B.waveEverySec);
  }
  initAbilities(s);
  return s;
}

function queue(u: Unit, at: number) { u.alive = false; u.pending = true; u.spawnAt = at; }
function stagger(us: Unit[], from: number): Unit[] { us.forEach((u, i) => queue(u, from + i * ticks(B.spawnGapSec))); return us; }

/** Выход из базы: ожидающие появляются, павшие из отряда встают в очередь на возвращение. */
function spawns(s: BattleState) {
  for (const u of s.units) {
    if (u.kind === 'base' || u.temp) continue;
    if (u.alive) { u.spawnAt = undefined; continue; }
    if (u.spawnAt === undefined) {
      if (u.side === 'party') u.spawnAt = s.tick + ticks(u.kind === 'hero' ? B.heroRespawnSec : B.creepRespawnSec);
      continue;
    }
    if (s.tick < u.spawnAt) continue;
    const homeX = u.side === 'party' ? B.partyBaseX + 0.5 : WAVE_X;
    u.alive = true; u.pending = false; u.spawnAt = undefined; u.x = homeX; u.hp = u.maxHp;
    u.attackCooldown = 0; u.shield = 0; u.stacks = 0; u.revived = false; u.recalled = false;
    if (u.cds) u.cds = u.cds.map(() => 0);
    // постоянные эффекты (расовые пассивки) остаются, временные - нет
    if (u.effects) u.effects = u.effects.filter(e => e.until >= 1e9);
  }
}

function mkUnit(side: Unit['side'], race: Race, kind: Unit['kind'], refId: string, x: number, stats: Stats): Unit {
  return { id: newId(), side, race, kind, refId, x, hp: stats.hp, maxHp: stats.hp, stats, attackCooldown: 0, alive: true };
}

/** Один тик (100 мс). Мутирует state для скорости; снаружи считать его непрозрачным. */
export function step(s: BattleState): BattleState {
  if (s.finished) return s;
  const rnd = mulberry32(s.rngState + s.tick);
  const ownBase = s.waveGen ? undefined : s.units.find(u => u.side === 'party' && u.kind === 'base');
  if (ownBase) {
    // база пала или этаж затянулся - поражение, игра откатит на этаж назад
    if (!ownBase.alive || s.tick >= ticks(B.floorTimeSec)) { s.finished = 'lose'; return s; }
    spawns(s);
  }
  const party = s.units.filter(u => u.alive && u.side === 'party');
  const enemy = s.units.filter(u => u.alive && u.side === 'enemy');
  if (!ownBase && party.length === 0) { s.finished = 'lose'; return s; }
  const waveLeft = s.units.some(u => u.side === 'enemy' && u.kind !== 'base' && (u.alive || u.pending));
  if (s.waveGen) {
    // подземелье: волна за волной, пока не выйдет время
    if (!waveLeft) {
      s.wave++;
      s.units.push(...s.waveGen(s.wave, WAVE_X));
      s.tick++;
      return s;
    }
  } else {
    const enemyBase = s.units.find(u => u.side === 'enemy' && u.kind === 'base');
    if (enemyBase && !enemyBase.alive) {
      s.goldEarned += floorGold(s.floor) * 0.4 * (s.goldMult ?? 1);
      s.finished = 'win';
      return s;
    }
    // Вражеская база шлёт волны, пока её не сломают: следующая - когда выбита прежняя или по таймеру.
    // после волн этажа - только по таймеру, иначе сильный отряд не успевает к базе
    if ((!waveLeft && s.wave < WAVES) || s.tick >= (s.nextWaveAt ?? Infinity)) {
      s.wave++;
      s.units.push(...stagger(spawnWave(s.floor, s.wave, WAVE_X), s.tick));
      s.nextWaveAt = s.tick + ticks(B.waveEverySec);
    }
    // с последней волны этажа (там же босс) базу можно бить
    if (s.wave >= WAVES) s.baseOpen = true;
  }
  applyAbilities(s, rnd);
  for (const u of s.units) {
    if (!u.alive || u.kind === 'base') continue;
    if (isStunned(u, s.tick)) { u.attackCooldown -= DT; continue; }
    const foes = u.side === 'party' ? (s.baseOpen ? enemy : enemy.filter(e => e.kind !== 'base')) : party;
    const target = pickTarget(s, u, foes);
    if (!target) { u.attackCooldown -= DT; continue; }
    const dist = Math.abs(target.x - u.x);
    // хилер: лечит союзника с наименьшим % HP вместо атаки
    if (u.healPower && u.attackCooldown <= 0) {
      const allies = (u.side === 'party' ? party : enemy).filter(a => a.alive && a.kind !== 'base' && a.hp < a.maxHp);
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
  prune(s);
  s.tick++;
  return s;
}

/** Павшие враги и призванные копятся при непрерывных волнах - через секунду (анимация смерти) убираем их из боя. */
function prune(s: BattleState) {
  let dead = false;
  for (const u of s.units) {
    if (u.alive || u.pending || u.kind === 'base' || (u.side === 'party' && !u.temp)) { u.diedAt = undefined; continue; }
    u.diedAt ??= s.tick;
    if (s.tick - u.diedAt > 10) dead = true;
  }
  if (dead) s.units = s.units.filter(u => u.diedAt === undefined || s.tick - u.diedAt <= 10);
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
