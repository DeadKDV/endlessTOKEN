/**
 * Тик боя. Детерминирован: одинаковые входы + seed → одинаковый исход (нужно для сервера).
 * Способности героев пока не исполняются — есть точка расширения `applyAbilities`.
 */
import economy from '../data/economy.json';
import { mulberry32 } from './rng';
import { raceMult } from './races';
import { spawnWave, newId, resetIds } from './floor';
import { floorGold } from './economy';
import type { BattleState, Unit, Race, Stats, CreepType } from './types';

const DT = economy.tickMs / 1000;
const WAVES = economy.floor.wavesPerFloor;
const PARTY_START_X = 0;
const ENEMY_START_X = 10;

export interface PartyMember {
  heroId: string; race: Race; stats: Stats;
  creeps: { type: CreepType; race: Race; stats: Stats; heal?: number }[];
}

export function createBattle(floor: number, party: PartyMember[], seed: number): BattleState {
  resetIds();
  const units: Unit[] = [];
  party.forEach((m, i) => {
    units.push(mkUnit('party', m.race, 'hero', m.heroId, PARTY_START_X - i * 0.5, m.stats));
    m.creeps.forEach((c, j) => {
      const off = c.type === 'infantry' ? 0.8 : c.type === 'ranged' ? -1.0 : -1.5;
      const u = mkUnit('party', c.race, 'creep', `${c.race}_${c.type}`, PARTY_START_X + off - j * 0.3 - i * 0.5, c.stats);
      u.healPower = c.heal;
      units.push(u);
    });
  });
  const s: BattleState = { floor, wave: 1, tick: 0, units, seed, rngState: seed, goldEarned: 0, finished: null };
  s.units.push(...spawnWave(floor, 1, ENEMY_START_X));
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
  if (enemy.length === 0) {
    if (s.wave >= WAVES) { s.finished = 'win'; s.goldEarned += floorGold(s.floor) * 0.4; return s; }
    s.wave++;
    const frontX = Math.max(...party.map(u => u.x));
    s.units.push(...spawnWave(s.floor, s.wave, frontX + ENEMY_START_X));
    s.tick++;
    return s;
  }
  for (const u of s.units) {
    if (!u.alive) continue;
    const foes = u.side === 'party' ? enemy : party;
    const target = nearest(u, foes);
    if (!target) continue;
    const dist = Math.abs(target.x - u.x);
    // хилер: лечит союзника с наименьшим % HP вместо атаки
    if (u.healPower && u.attackCooldown <= 0) {
      const allies = (u.side === 'party' ? party : enemy).filter(a => a.alive && a.hp < a.maxHp);
      if (allies.length) {
        const low = allies.reduce((a, b) => (a.hp / a.maxHp < b.hp / b.maxHp ? a : b));
        low.hp = Math.min(low.maxHp, low.hp + u.healPower);
        u.attackCooldown = 1 / u.stats.atkSpeed;
      }
    }
    if (dist > u.stats.range) {
      if (u.stats.moveSpeed > 0) u.x += Math.sign(target.x - u.x) * u.stats.moveSpeed * DT;
    } else if (u.attackCooldown <= 0 && !u.healPower) {
      let dmg = u.stats.atk * raceMult(u.race, target.race);
      if (rnd() < u.stats.crit) dmg *= u.stats.critDmg;
      target.hp -= dmg;
      if (target.hp <= 0) {
        target.alive = false;
        if (target.side === 'enemy') s.goldEarned += floorGold(s.floor) * 0.6 / (economy.floor.mobsPerWave * WAVES);
      }
      u.attackCooldown = 1 / u.stats.atkSpeed;
    }
    u.attackCooldown -= DT;
  }
  s.tick++;
  return s;
}

function nearest(u: Unit, foes: Unit[]): Unit | undefined {
  let best: Unit | undefined; let bd = Infinity;
  for (const f of foes) { const d = Math.abs(f.x - u.x); if (d < bd) { bd = d; best = f; } }
  return best;
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
