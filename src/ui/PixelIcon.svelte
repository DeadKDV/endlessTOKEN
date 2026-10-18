<script lang="ts">
  import { ICONS, iconRects } from './pixelIcons';

  let { name, size = 36, tint, dim = false }: { name: string; size?: number; tint?: string; dim?: boolean } = $props();
  const rects = $derived(ICONS[name] ? iconRects(ICONS[name], tint) : []);
</script>

<svg viewBox="0 0 8 8" width={size} height={size} shape-rendering="crispEdges" class:dim aria-hidden="true">
  {#each rects as r}<rect x={r.x} y={r.y} width={r.w} height="1" fill={r.fill} />{/each}
</svg>

<style>
  svg { flex: none; background: #0c0c1a; border: 1px solid #2a2a44; border-radius: 4px; padding: 2px; box-sizing: content-box; }
  .dim { filter: grayscale(1) brightness(0.6); }
</style>
