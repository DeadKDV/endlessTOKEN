<script lang="ts">
  import { save, buyBuildingAction } from '../game';
  import { buildingById, buildingLevel, buildingUpgradeCost } from '../sim/buildings';
  import BuyButtons from './BuyButtons.svelte';
  import { fmt } from './format';
  import { t, tpl, buildingEffectText } from './text';

  let { id }: { id: string } = $props();
  const b = $derived(buildingById(id)!);
  const lvl = $derived(buildingLevel($save, id));
  const maxed = $derived(lvl >= b.maxLevel);
  const cost = $derived(buildingUpgradeCost(b, lvl));
</script>

<div class="row">
  <span>
    <b>{b.name.ru}</b> · {tpl(t.building.level, { n: lvl, max: b.maxLevel })}<br />
    <span class="muted">{buildingEffectText(b, lvl)}</span>
  </span>
  <span class="col">
    {#if maxed}
      <span class="muted">{t.building.maxed}</span>
    {:else}
      <span class="muted">{tpl(t.building.cost, { n: fmt(cost) })}</span>
      <BuyButtons can={$save.floorPoints >= cost} onbuy={n => buyBuildingAction(id, n)} />
    {/if}
  </span>
</div>

<style>
  .col { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; }
</style>
