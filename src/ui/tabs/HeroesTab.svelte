<script lang="ts">
  import { save, heroCard, levelUpHero, togglePartyAction, movePartyAction, summonHeroAction } from '../../game';
  import { heroLevelCost } from '../../sim/economy';
  import { HEROES, heroById } from '../../sim/party';
  import { partySlots, summonCost } from '../../sim/heroes';
  import HeroPortrait from '../HeroPortrait.svelte';
  import BuyButtons from '../BuyButtons.svelte';
  import { fmt } from '../format';
  import { t, tpl, nm } from '../text';

  const slots = $derived(partySlots($save.maxFloor));
  const reserve = $derived(Object.keys($save.heroes).filter(id => !$save.party.includes(id)));
  const unowned = $derived(HEROES.filter(h => !$save.heroes[h.id]));
</script>

<div class="muted">{tpl(t.hero.slots, { n: $save.party.length, max: slots })}</div>

{#snippet hero(id: string, inParty: boolean)}
  {@const h = $save.heroes[id]}
  <div class="tile">
    <span class="link" role="button" tabindex="0" onclick={() => heroCard.set(id)} onkeydown={e => e.key === 'Enter' && heroCard.set(id)}>
      <HeroPortrait heroId={id} form={h.form} size={56} />
    </span>
    <div class="info">
      <b>{nm(heroById(id)?.name).split(',')[0]}</b>
      <span class="muted">{tpl(t.level, { n: h.lvl })} · {t.form[String(h.form) as '0' | '1' | '2']} · {fmt(heroLevelCost(h.lvl))} 💰</span>
      <BuyButtons can={Number($save.gold) >= heroLevelCost(h.lvl)} onbuy={n => levelUpHero(id, n)} />
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
  <div class="grid">
    {#each unowned as h (h.id)}
      <div class="cell">
        <HeroPortrait heroId={h.id} size={56} dim />
        <span class="muted">{nm(h.name).split(',')[0]}</span>
        <span class="muted">{t.race[h.race as 'human']} · {t.role[h.role as 'tank']}</span>
        <button disabled={$save.crystals < summonCost($save)} onclick={() => summonHeroAction(h.id)}>
          {t.hero.summon} {tpl(t.hero.summonCrystals, { n: summonCost($save) })}
        </button>
      </div>
    {/each}
  </div>
{/if}

<style>
  .link { cursor: pointer; }
  .info { display: flex; flex-direction: column; gap: 3px; align-items: flex-start; min-width: 0; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(104px, 1fr)); gap: 6px; }
  .cell { display: flex; flex-direction: column; align-items: center; gap: 2px; text-align: center; background: #16162b; border: 1px solid #2a2a44; border-radius: 6px; padding: 6px 2px; }
  .cell button { padding: 4px 4px; font-size: 11px; }
  h4 { margin: 8px 0 4px; color: #ffd54f; }
</style>
