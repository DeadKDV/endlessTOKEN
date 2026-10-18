<script lang="ts">
  import BuildingGroups from '../BuildingGroups.svelte';
</script>

<BuildingGroups zone="village" order={['barracks', 'squad']} group={b => (b.id.startsWith('barracks_') ? 'barracks' : 'squad')} />
