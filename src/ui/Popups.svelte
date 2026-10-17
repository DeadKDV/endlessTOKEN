<script lang="ts">
  import { save, offlinePopup, eggPopup, dungeonResult, prestigeAsk, prestige, summonReveal, togglePartyAction } from '../game';
  import { partySlots } from '../sim/heroes';
  import HeroPortrait from './HeroPortrait.svelte';
  import { heroById } from '../sim/party';
  import { prestigeGain } from '../sim/prestige';
  import { fmt } from './format';
  import { t, tpl } from './text';
</script>

{#if $summonReveal && heroById($summonReveal)}
  {@const h = heroById($summonReveal)!}
  <div class="reveal">
    <div class="flash"></div>
    <h3>{t.reveal.title}</h3>
    <div class="big"><HeroPortrait heroId={h.id} form={0} size={144} /></div>
    <b>{h.name.ru.split(',')[0]}</b>
    <p class="muted">{t.race[h.race as 'human']} · {t.role[h.role as 'tank']}</p>
    <div>
      {#if !$save.party.includes(h.id)}
        <button disabled={$save.party.length >= partySlots($save.maxFloor)} onclick={() => { togglePartyAction(h.id); summonReveal.set(null); }}>{t.hero.add}</button>
      {/if}
      <button onclick={() => summonReveal.set(null)}>{t.hero.close}</button>
    </div>
  </div>
{:else if $offlinePopup}
  <div class="modal">
    <h3>{t.offline.title}</h3>
    <p>{t.offline.earned} 💰 {fmt($offlinePopup.gold)}</p>
    {#if $offlinePopup.capped}<p class="warn">{t.offline.capped}</p>{/if}
    <button onclick={() => offlinePopup.set(null)}>{t.action.collect}</button>
  </div>
{:else if $prestigeAsk}
  <div class="modal">
    <h3>{t.action.prestige}</h3>
    <p>{tpl(t.prestige.confirm, { n: prestigeGain($save) })}</p>
    <button onclick={() => { prestige(); prestigeAsk.set(false); }}>{t.prestige.button}</button>
    <button onclick={() => prestigeAsk.set(false)}>{t.popup.cancel}</button>
  </div>
{:else if $eggPopup}
  <div class="modal">
    <h3>🥚 {t.popup.egg}</h3>
    <p>{tpl(t.popup.eggText, { name: heroById($eggPopup)?.name.ru.split(',')[0] ?? '' })}</p>
    <button onclick={() => eggPopup.set(null)}>{t.popup.ok}</button>
  </div>
{:else if $dungeonResult}
  <div class="modal">
    <h3>{t.dungeonUi.result}</h3>
    <p>{t.dungeon[$dungeonResult.id as 'crypt']}</p>
    <p>{tpl(t.dungeonUi.resultWaves, { n: $dungeonResult.waves })}</p>
    <p>{tpl(t.dungeonUi.resultGain, { n: $dungeonResult.amount })}</p>
    <button onclick={() => dungeonResult.set(null)}>{t.action.collect}</button>
  </div>
{/if}

<style>
  .modal { position: absolute; inset: 30% 10%; z-index: 30; background: #1a1a2e; border: 2px solid #ffd54f; border-radius: 8px; padding: 16px; color: #fff; text-align: center; font: 14px monospace; }
  .reveal { position: absolute; inset: 0; z-index: 40; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; background: rgba(5, 5, 14, 0.92); color: #fff; font: 14px monospace; animation: fade 0.3s ease-out; }
  .reveal h3 { margin: 0; color: #ffd54f; }
  .big { animation: pop 0.5s cubic-bezier(0.2, 1.4, 0.4, 1); }
  .flash { position: absolute; inset: 0; background: #fff; opacity: 0; pointer-events: none; animation: flash 0.7s ease-out; }
  @keyframes fade { from { opacity: 0; } }
  @keyframes pop { from { transform: scale(0.3); opacity: 0; } }
  @keyframes flash { 0% { opacity: 0.9; } 100% { opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .reveal, .big, .flash { animation: none; } }
  .modal p { margin: 6px 0; }
</style>
