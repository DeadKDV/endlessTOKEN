<script lang="ts">
  import { save, claimFood } from '../../game';
  import { BUILDINGS, buildingLevel } from '../../sim/buildings';
  import { offlineHours } from '../../sim/economy';
  import { dailyFoodAmount } from '../../sim/pets';
  import { localDate } from '../../sim/party';
  import economy from '../../data/economy.json';
  import BuildingRow from '../BuildingRow.svelte';
  import { t, tpl } from '../text';

  const hours = $derived(offlineHours(buildingLevel($save, 'storage')));
  const claimed = $derived($save.dailyFoodDay === localDate(Date.now()));
</script>

<div class="meter" title={t.building.offlineMeter}>
  <div class="fill" style:width="{(hours / economy.offline.maxHours) * 100}%"></div>
  <span>{tpl(t.building.offlineMeter, { n: hours, max: economy.offline.maxHours })}</span>
</div>

{#each BUILDINGS.filter(b => b.zone === 'base') as b (b.id)}
  <BuildingRow id={b.id} />
{/each}

<div class="row">
  <span>🍖 {$save.petFood}</span>
  <button disabled={claimed} onclick={claimFood}>
    {claimed ? t.building.dailyFoodDone : tpl(t.building.dailyFood, { n: dailyFoodAmount($save) })}
  </button>
</div>

<style>
  .meter { position: relative; height: 18px; background: #222; border: 1px solid #444; border-radius: 3px; margin-bottom: 4px; overflow: hidden; }
  .fill { position: absolute; inset: 0 auto 0 0; background: #3b5d2f; }
  .meter span { position: relative; padding-left: 6px; line-height: 18px; font-size: 11px; }
</style>
