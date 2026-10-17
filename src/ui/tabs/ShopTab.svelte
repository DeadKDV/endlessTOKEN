<script lang="ts">
  // Траты самоцветов (DESIGN.md). Реальной оплаты нет: пакеты за деньги подключатся позже.
  import { save, summonHeroAction, resetDungeonRuns, buyPermGoldAction, claimStarterPackAction } from '../../game';
  import { HEROES, heroById } from '../../sim/party';
  import economy from '../../data/economy.json';
  import HeroPortrait from '../HeroPortrait.svelte';
  import { t, tpl } from '../text';

  const G = economy.gems;
  const unowned = $derived(HEROES.filter(h => !$save.heroes[h.id]));
  let pick = $state('');
  const target = $derived(unowned.find(h => h.id === pick)?.id ?? unowned[0]?.id ?? '');
</script>

<div class="tile">
  <span>{t.shop.starter}<br /><span class="muted">{tpl(t.shop.starterHint, { g: G.starterPack.gems, gold: G.starterPack.gold, f: G.starterPack.petFood })}</span></span>
  {#if $save.perks.starterPack}
    <span class="muted">{t.shop.bought}</span>
  {:else}
    <button onclick={claimStarterPackAction}>{t.shop.claim}</button>
  {/if}
</div>

<div class="tile col2">
  <span>{t.shop.summon}<br /><span class="muted">{unowned.length ? t.shop.summonHint : t.shop.free}</span></span>
  <div class="grid">
    {#each unowned as h (h.id)}
      <button class="pick" class:sel={h.id === target} aria-label={h.name.ru} title={h.name.ru.split(',')[0]} onclick={() => (pick = h.id)}>
        <HeroPortrait heroId={h.id} size={48} dim={h.id !== target} />
      </button>
    {/each}
  </div>
  {#if target}<span>{heroById(target)?.name.ru.split(',')[0]}</span>{/if}
  <button disabled={!target || $save.gems < G.heroSummon} onclick={() => summonHeroAction(target, 'gems')}>{tpl(t.shop.cost, { n: G.heroSummon })}</button>
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
<div class="row"><span class="muted">{t.shop.subscription}</span><span class="muted">{t.shop.soon}</span></div>
<div class="row"><span class="muted">{t.shop.bundles}</span><span class="muted">{t.shop.soon}</span></div>

<style>
  .col2 { flex-direction: column; align-items: stretch; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(52px, 1fr)); gap: 4px; }
  .pick { padding: 0; border: 0; background: none; border-radius: 4px; }
  .sel { outline: 2px solid #ffd54f; outline-offset: 1px; }
</style>
