<script lang="ts">
  import { state, offlinePopup, levelUpHero } from '../game';
  import { heroLevelCost } from '../sim/economy';
  import { heroById } from '../sim/party';
  import ru from '../data/i18n/ru.json';
  import AdButtons from './AdButtons.svelte';
  import { fmt } from './format';

  let tab: 'battle' | 'heroes' | 'village' | 'base' | 'dungeons' | 'guild' | 'shop' = $state('battle');
  const tabs = ['battle', 'heroes', 'village', 'base', 'dungeons', 'guild', 'shop'] as const;
</script>

<div class="top">
  <span>💰 {fmt(Number($state.gold))}</span>
  <span>⭐ {$state.floorPoints}</span>
  <span>💎 {$state.gems}</span>
  <span>🔮 {$state.crystals}</span>
</div>

<div class="panel">
  {#if tab === 'battle'}
    <AdButtons />
  {:else if tab === 'heroes'}
    {#each Object.entries($state.heroes) as [id, h]}
      {@const def = heroById(id)}
      <div class="row">
        <span>{def?.name.ru} · {ru.level.replace('{n}', String(h.lvl))} · {ru.form[String(h.form) as '0'|'1'|'2']}</span>
        <button onclick={() => levelUpHero(id)} disabled={Number($state.gold) < heroLevelCost(h.lvl)}>
          {ru.action.upgrade} {fmt(heroLevelCost(h.lvl))}
        </button>
      </div>
    {/each}
  {:else}
    <p class="stub">{ru.screen[tab]} — экран в разработке (см. docs/SCREENS.md)</p>
  {/if}
</div>

<nav>
  {#each tabs as t}
    <button class:active={tab === t} onclick={() => (tab = t)}>{ru.screen[t]}</button>
  {/each}
</nav>

{#if $offlinePopup}
  <div class="modal">
    <h3>{ru.offline.title}</h3>
    <p>{ru.offline.earned} 💰 {fmt($offlinePopup.gold)}</p>
    {#if $offlinePopup.capped}<p class="warn">{ru.offline.capped}</p>{/if}
    <button onclick={() => offlinePopup.set(null)}>{ru.action.collect}</button>
  </div>
{/if}

<style>
  .top { position: absolute; top: 0; left: 0; right: 0; height: 40px; display: flex; justify-content: space-around; align-items: center; color: #fff; font: 14px monospace; background: #15152a; }
  .panel { position: absolute; top: 69%; left: 0; right: 0; bottom: 56px; overflow-y: auto; padding: 8px; color: #ddd; font: 13px monospace; background: #101020; }
  .row { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid #222; }
  nav { position: absolute; bottom: 0; left: 0; right: 0; height: 56px; display: flex; background: #15152a; }
  nav button { flex: 1; background: none; border: 0; color: #888; font: 11px monospace; }
  nav button.active { color: #fff; border-top: 2px solid #ffd54f; }
  button { background: #2a2a44; color: #fff; border: 1px solid #444; border-radius: 4px; padding: 6px 10px; font: 12px monospace; }
  button:disabled { opacity: 0.4; }
  .modal { position: absolute; inset: 30% 10%; background: #1a1a2e; border: 2px solid #ffd54f; border-radius: 8px; padding: 16px; color: #fff; text-align: center; font: 14px monospace; }
  .warn { color: #ff9f43; }
  .stub { color: #666; text-align: center; margin-top: 40px; }
</style>
