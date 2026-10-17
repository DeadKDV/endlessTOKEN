<script lang="ts">
  import { save, heroCard, levelUpHero, togglePartyAction, movePartyAction, summonHeroAction } from '../../game';
  import { heroLevelCost } from '../../sim/economy';
  import { HEROES, heroById } from '../../sim/party';
  import { partySlots } from '../../sim/heroes';
  import economy from '../../data/economy.json';
  import BuyButtons from '../BuyButtons.svelte';
  import { fmt } from '../format';
  import { t, tpl } from '../text';

  const slots = $derived(partySlots($save.maxFloor));
  const reserve = $derived(Object.keys($save.heroes).filter(id => !$save.party.includes(id)));
  const unowned = $derived(HEROES.filter(h => !$save.heroes[h.id]));
</script>

<div class="muted">{tpl(t.hero.slots, { n: $save.party.length, max: slots })}</div>

{#snippet hero(id: string, inParty: boolean)}
  {@const h = $save.heroes[id]}
  <div class="row">
    <span class="link" role="button" tabindex="0" onclick={() => heroCard.set(id)} onkeydown={e => e.key === 'Enter' && heroCard.set(id)}>
      {heroById(id)?.name.ru.split(',')[0]} · {tpl(t.level, { n: h.lvl })} · {t.form[String(h.form) as '0' | '1' | '2']}
    </span>
    <BuyButtons can={Number($save.gold) >= heroLevelCost(h.lvl)} onbuy={n => levelUpHero(id, n)} />
  </div>
  <div class="row sub">
    <span class="muted">{fmt(heroLevelCost(h.lvl))} 💰</span>
    <span>
      {#if inParty}
        <button onclick={() => movePartyAction(id, -1)}>{t.hero.left}</button>
        <button onclick={() => movePartyAction(id, 1)}>{t.hero.right}</button>
        <button disabled={$save.party.length < 2} onclick={() => togglePartyAction(id)}>{t.hero.remove}</button>
      {:else}
        <button disabled={$save.party.length >= slots} onclick={() => togglePartyAction(id)}>{t.hero.add}</button>
      {/if}
    </span>
  </div>
{/snippet}

<h4>{t.hero.party}</h4>
{#each $save.party as id (id)}{@render hero(id, true)}{/each}

{#if reserve.length}
  <h4>{t.hero.reserve}</h4>
  {#each reserve as id (id)}{@render hero(id, false)}{/each}
{/if}

{#if unowned.length}
  <h4>{t.hero.locked}</h4>
  {#each unowned as h (h.id)}
    <div class="row">
      <span class="muted">{h.name.ru.split(',')[0]} · {t.race[h.race as 'human']} · {t.role[h.role as 'tank']}</span>
      <button disabled={$save.crystals < economy.prestige.heroSummonCost} onclick={() => summonHeroAction(h.id)}>
        {t.hero.summon} {tpl(t.hero.summonCrystals, { n: economy.prestige.heroSummonCost })}
      </button>
    </div>
  {/each}
{/if}

<style>
  .link { cursor: pointer; text-decoration: underline dotted; }
  .sub { border-bottom: 1px solid #333; padding-top: 0; }
  h4 { margin: 8px 0 2px; color: #ffd54f; }
</style>
