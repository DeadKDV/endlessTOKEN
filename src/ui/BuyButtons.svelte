<script lang="ts">
  // Кнопки «Улучшить ×1 / ×10 / ×макс». Долгий тап по ×1 — автоповтор (docs/SCREENS.md).
  import { t } from './text';

  let { onbuy, can = true }: { onbuy: (count: number | 'max') => void; can?: boolean } = $props();

  let timer: ReturnType<typeof setInterval> | undefined;
  let hold: ReturnType<typeof setTimeout> | undefined;
  function down() {
    hold = setTimeout(() => { timer = setInterval(() => onbuy(1), 120); }, 400);
  }
  function up() { clearTimeout(hold); clearInterval(timer); timer = undefined; }
</script>

<span class="buy">
  <button disabled={!can} onpointerdown={down} onpointerup={up} onpointerleave={up} onclick={() => onbuy(1)}>{t.hero.x1}</button>
  <button disabled={!can} onclick={() => onbuy(10)}>{t.hero.x10}</button>
  <button disabled={!can} onclick={() => onbuy('max')}>{t.hero.xmax}</button>
</span>

<style>
  .buy { display: inline-flex; gap: 3px; }
  button { padding: 4px 6px; }
</style>
