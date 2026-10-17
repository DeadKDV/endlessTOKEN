<script lang="ts">
  // Кнопка с автоповтором при долгом нажатии (docs/SCREENS.md, «Жесты»).
  import type { Snippet } from 'svelte';

  let { onpress, disabled = false, label, children }: { onpress: () => void; disabled?: boolean; label?: string; children: Snippet } = $props();

  let timer: ReturnType<typeof setInterval> | undefined;
  let hold: ReturnType<typeof setTimeout> | undefined;
  let repeated = false;
  function down() {
    repeated = false;
    hold = setTimeout(() => { repeated = true; timer = setInterval(onpress, 120); }, 400);
  }
  function up() { clearTimeout(hold); clearInterval(timer); timer = undefined; }
  function click() { if (!repeated) onpress(); repeated = false; }
  $effect(() => { if (disabled) up(); return up; });
</script>

<button {disabled} aria-label={label} onpointerdown={down} onpointerup={up} onpointerleave={up} onpointercancel={up} onclick={click}>{@render children()}</button>
