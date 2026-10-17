import { floorGold, goldPerSec, offlineHours } from './economy';

/** Секунд на прохождение одного этажа при текущем DPS — грубая оценка для досчёта без боёв. */
export function estimateFloorSeconds(floor: number, partyDps: number, totalFloorHp: number): number {
  if (partyDps <= 0) return Infinity;
  return Math.max(5, totalFloorHp / partyDps);
}

export interface OfflineResult { seconds: number; gold: number; capped: boolean }

/**
 * Досчёт оффлайна: доход = (золото этажа / секунд на этаж + добыча шахты) × время,
 * время ограничено лимитом Склада. Этаж не двигается — игрок "фармит" текущий.
 */
export function computeOffline(nowMs: number, savedAtMs: number, floor: number, floorSeconds: number, mineLevel: number, storageLevel: number, rateMult = 1): OfflineResult {
  const capSec = offlineHours(storageLevel) * 3600;
  const rawSec = Math.max(0, (nowMs - savedAtMs) / 1000);
  const seconds = Math.min(rawSec, capSec);
  const perSec = (Number.isFinite(floorSeconds) ? floorGold(floor) / floorSeconds : 0) + goldPerSec(mineLevel);
  return { seconds, gold: perSec * seconds * rateMult, capped: rawSec > capSec };
}
