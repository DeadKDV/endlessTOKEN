<script lang="ts">
  // Траты самоцветов (DESIGN.md). Реальной оплаты нет: пакеты за деньги подключатся позже.
  import { save, summonHeroAction, resetDungeonRuns, buyPermGoldAction } from '../../game';
  import { HEROES } from '../../sim/party';
  import economy from '../../data/economy.json';
  import { t, tpl } from '../text';

  const G = economy.gems;
  const unowned = $derived(HEROES.filter(h => !$save.heroes[h.id]));
  let pick = $state('');
  const target = $derived(unowned.find(h => h.id === pick)?.id ?? unowned[0]?.id ?? '');
</script>

<div class="row">
  <span>{t.shop.summon}<br /><span class="muted">{unowned.length ? t.shop.summonHint : t.shop.free}</span></span>
  <span class="col">
    <select bind:value={pick} disabled={!unowned.length}>
      {#each unowned as h (h.id)}<option value={h.id}>{h.name.ru.split(',')[0]}</option>{/each}
    </select>
    <button disabled={!target || $save.gems < G.heroSummon} onclick={() => summonHeroAction(target, 'gems')}>{tpl(t.shop.cost, { n: G.heroSummon })}</button>
  </span>
</div>

<div class="row">
  <span>{t.shop.resetRuns}</span>
  <button disabled={$save.gems < G.dungeonReset} onclick={resetDungeonRuns}>{tpl(t.shop.cost, { n: G.dungeonReset })}</button>
</div>

<div class="row">
  <span>{t.shop.permGold}</span>
  {#if $save.perks.permGold}
    <span class="muted">{t.shop.bought}</span>
  {:else}
    <button disabled={$save.gems < G.permanentGold.cost} onclick={buyPermGoldAction}>{tpl(t.shop.cost, { n: G.permanentGold.cost })}</button>
  {/if}
</div>

<div class="row"><span class="muted">{t.shop.cosmetics}</span><span class="muted">{t.shop.soon}</span></div>
<div class="row"><span class="muted">{t.shop.raid}</span><span class="muted">{t.shop.soon}</span></div>
<p class="muted">{t.shop.packs}</p>

<style>
  .col { display: flex; flex-direction: column; gap: 3px; align-items: flex-end; }
  select { background: #2a2a44; color: #fff; border: 1px solid #444; font: 12px monospace; }
</style>
