import economy from '../data/economy.json';

const E = economy;

/** HP обычного моба на этаже n. */
export function mobHp(n: number): number {
  return E.mob.hpBase * Math.pow(E.mob.hpGrowth, n) * Math.pow(E.mob.hpStepMult, Math.floor(n / E.mob.hpStepEvery));
}
export function mobAtk(n: number): number {
  return E.mob.atkBase * Math.pow(E.mob.atkGrowth, n);
}
export function baseHp(n: number): number {
  return E.mob.baseHpMult * mobHp(n);
}
/** Золото за прохождение этажа n (сумма всех мобов + база). */
export function floorGold(n: number): number {
  return E.rewards.goldBase * Math.pow(E.rewards.goldGrowth, n);
}
export function floorPoints(n: number): number {
  return 1 + Math.floor(n / E.rewards.floorPointsPerN);
}
/** Стоимость покупки уровня L (переход L → L+1). */
export function heroLevelCost(L: number): number {
  return E.hero.costBase * Math.pow(E.hero.costGrowth, L);
}
export function heroAtk(base: number, L: number, form: 0 | 1 | 2, petLevel = 0): number {
  return base * Math.pow(E.hero.atkGrowth, L) * Math.pow(E.hero.milestoneMult, Math.floor(L / E.hero.milestoneEvery))
    * E.hero.formMult[form] * Math.pow(1 + E.pets.statPerLevel, petLevel);
}
export function heroHp(base: number, L: number, form: 0 | 1 | 2, petLevel = 0): number {
  return base * Math.pow(E.hero.hpGrowth, L) * Math.pow(E.hero.milestoneMult, Math.floor(L / E.hero.milestoneEvery))
    * E.hero.formMult[form] * Math.pow(1 + E.pets.statPerLevel, petLevel);
}
export function creepCap(form: 0 | 1 | 2, petLevel: number, bannerLevel: number, warDrum = 0): number {
  return E.hero.creepsPerForm[form] + Math.floor(petLevel / E.pets.creepEveryLevels) + Math.floor(bannerLevel / 25) + warDrum;
}
export function petFoodCost(level: number): number {
  return E.pets.foodCostPerLevel * Math.pow(level, E.pets.foodCostPower);
}
export function buildingCost(costBase: number, growth: number, level: number): number {
  return costBase * Math.pow(growth, level);
}
export function goldPerSec(mineLevel: number): number {
  if (mineLevel <= 0) return 0;
  return 5 * mineLevel * Math.pow(1.1, mineLevel);
}
export function offlineHours(storageLevel: number): number {
  return Math.min(E.offline.maxHours, E.offline.baseHours + Math.floor(storageLevel / 10));
}
