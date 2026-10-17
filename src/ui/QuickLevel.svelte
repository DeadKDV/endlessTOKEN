<script lang="ts">
  // Быстрая прокачка отряда прямо под боем (как в EF): портрет, уровень, «▲» (×1, долгое нажатие — автоповтор).
  import { save, levelUpHero } from '../game';
  import { heroLevelCost } from '../sim/economy';
  import HeroPortrait from './HeroPortrait.svelte';
  import HoldButton from './HoldButton.svelte';
  import { t, tpl } from './text';
</script>

<div class="quick" data-tut="quick" aria-label={t.progress.quick}>
  {#each $save.party as id (id)}
    {@const h = $save.heroes[id]}
    {#if h}
      <div class="cell">
        <HeroPortrait heroId={id} form={h.form} size={40} />
        <span class="muted">{tpl(t.level, { n: h.lvl })}</span>
        <HoldButton label={t.progress.quickUp} disabled={Number($save.gold) < heroLevelCost(h.lvl)} onpress={() => levelUpHero(id, 1)}>▲</HoldButton>
      </div>
    {/if}
  {/each}
</div>

<style>
  .quick { display: flex; gap: 6px; margin: 8px 0 4px; }
  .cell { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 2px; background: #16162b; border: 1px solid #2a2a44; border-radius: 6px; padding: 4px 2px; }
  .cell :global(button) { width: 100%; padding: 0; }
</style>
