<script lang="ts">
  // Здания зоны, разложенные по подзаголовкам; group(b) возвращает ключ секции из t.buildingUi.
  import { BUILDINGS, type BuildingDef } from '../sim/buildings';
  import BuildingRow from './BuildingRow.svelte';
  import { t } from './text';

  let { zone, group, order }: { zone: 'village' | 'base'; group: (b: BuildingDef) => string; order: string[] } = $props();
  const sections = $derived(order.map(k => ({ k, items: BUILDINGS.filter(b => b.zone === zone && group(b) === k) })).filter(s => s.items.length));
</script>

{#each sections as s (s.k)}
  <h3>{(t.buildingUi as Record<string, string>)[s.k]}</h3>
  {#each s.items as b (b.id)}<BuildingRow id={b.id} />{/each}
{/each}

<style>
  h3 { margin: 10px 0 2px; font: 600 11px monospace; letter-spacing: 1px; text-transform: uppercase; color: #ffd54f; }
  h3:first-child { margin-top: 0; }
</style>
