<script lang="ts">
  import { BUILDINGS } from '../../sim/buildings';
  import BuildingRow from '../BuildingRow.svelte';
</script>

{#each BUILDINGS.filter(b => b.zone === 'village') as b (b.id)}
  <BuildingRow id={b.id} />
{/each}
