<script lang="ts">
  import { save, offlinePopup, eggPopup, dungeonResult, prestigeAsk, prestige } from '../game';
  import { heroById } from '../sim/party';
  import { prestigeGain } from '../sim/prestige';
  import { fmt } from './format';
  import { t, tpl } from './text';
</script>

{#if $offlinePopup}
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
  .modal p { margin: 6px 0; }
</style>
