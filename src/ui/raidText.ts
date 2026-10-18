import type { RaidReward } from '../sim/raid';
import { t } from './text';

export const rewardText = (r: RaidReward) =>
  [r.petFood && `${t.currency.petFood} +${r.petFood}`, r.gems && `${t.currency.gems} +${r.gems}`, r.crystals && `${t.currency.crystals} +${r.crystals}`].filter(Boolean).join(' · ');
