<script lang="ts">
  // Кнопки «Улучшить ×1 / ×10 / ×макс». Долгий тап по ×1 — автоповтор (docs/SCREENS.md).
  import { t } from './text';
  import HoldButton from './HoldButton.svelte';

  let { onbuy, can = true }: { onbuy: (count: number | 'max') => void; can?: boolean } = $props();
</script>

<span class="buy">
  <HoldButton disabled={!can} onpress={() => onbuy(1)}>{t.hero.x1}</HoldButton>
  <button disabled={!can} onclick={() => onbuy(10)}>{t.hero.x10}</button>
  <button disabled={!can} onclick={() => onbuy('max')}>{t.hero.xmax}</button>
</span>

<style>
  .buy { display: inline-flex; gap: 3px; }
  .buy :global(button) { padding: 4px 8px; }
</style>
