<script lang="ts">
  // Портрет рейд-босса дня: тот же процедурный спрайт, что в бою, в рамке цвета расы.
  import { procCanvas } from '../render/procSprites';
  import races from '../data/races.json';
  import type { Race } from '../sim/types';

  let { race, size = 64 }: { race: Race; size?: number } = $props();
  const src = $derived(procCanvas({ kind: 'boss', race, enemy: true, raid: true }).toDataURL());
  const color = $derived((races.races as Record<string, { palette: string[] }>)[race]?.palette[1] ?? '#888');
</script>

<span class="frame" style="width:{size}px;height:{size}px;border-color:{color}"><img {src} alt="" draggable="false" /></span>

<style>
  .frame { box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; flex: none; padding: 3px; border: 2px solid; border-radius: 4px; background: #0c0c1a; }
  img { width: 100%; height: 100%; object-fit: contain; image-rendering: pixelated; }
</style>
