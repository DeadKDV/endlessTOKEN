<script lang="ts">
  import { save, buyBuildingAction } from '../game';
  import { buildingById, buildingLevel, buildingUpgradeCost } from '../sim/buildings';
  import races from '../data/races.json';
  import BuyButtons from './BuyButtons.svelte';
  import PixelIcon from './PixelIcon.svelte';
  import { fmt } from './format';
  import { t, tpl, buildingEffectText, nm } from './text';

  let { id }: { id: string } = $props();
  const b = $derived(buildingById(id)!);
  const lvl = $derived(buildingLevel($save, id));
  const maxed = $derived(lvl >= b.maxLevel);
  const cost = $derived(buildingUpgradeCost(b, lvl));
  const can = $derived($save.floorPoints >= cost);
  const icon = $derived(b.effect.race ? 'barracks' : id);
  const tint = $derived(b.effect.race ? (races.races as Record<string, { palette: string[] }>)[b.effect.race]?.palette[1] : undefined);
  const now = $derived(buildingEffectText(b, lvl));
  const next = $derived(maxed ? '' : buildingEffectText(b, lvl + 1));
</script>

<div class="card" class:maxed class:poor={!maxed && !can}>
  <PixelIcon name={icon} {tint} dim={maxed} />
  <div class="body">
    <div class="head"><b>{nm(b.name)}</b><span class="muted">{tpl(t.building.level, { n: lvl, max: b.maxLevel })}</span></div>
    <div class="muted">{now}</div>
    {#if next && next !== now}<div class="next">&rarr; {next}</div>{/if}
    {#if maxed}
      <div class="muted cap">{t.building.maxed}</div>
    {:else}
      <div class="buy">
        <span class="price" class:short={!can}>{tpl(t.building.cost, { n: fmt(cost) })}</span>
        <BuyButtons {can} onbuy={n => buyBuildingAction(id, n)} />
      </div>
      {#if !can}<div class="muted">{tpl(t.buildingUi.short, { n: fmt(cost - $save.floorPoints) })}</div>{/if}
    {/if}
  </div>
</div>

<style>
  .card { display: flex; gap: 8px; padding: 6px 0; border-bottom: 1px solid #222; }
  .body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .head { display: flex; justify-content: space-between; gap: 6px; align-items: baseline; }
  .next { color: #8bc34a; font-size: 11px; }
  .buy { display: flex; justify-content: space-between; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 2px; }
  .price.short { color: #ff9f43; }
  .maxed { opacity: 0.55; }
  .poor { opacity: 0.85; }
  .cap { text-transform: uppercase; letter-spacing: 1px; }
</style>
