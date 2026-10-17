<script lang="ts">
  import { save, heroCard, dungeonRun } from '../game';
  import BattleTab from './tabs/BattleTab.svelte';
  import HeroesTab from './tabs/HeroesTab.svelte';
  import VillageTab from './tabs/VillageTab.svelte';
  import BaseTab from './tabs/BaseTab.svelte';
  import DungeonsTab from './tabs/DungeonsTab.svelte';
  import GuildTab from './tabs/GuildTab.svelte';
  import ShopTab from './tabs/ShopTab.svelte';
  import HeroCard from './HeroCard.svelte';
  import Popups from './Popups.svelte';
  import FloorStrip from './FloorStrip.svelte';
  import Toast from './Toast.svelte';
  import { tabHasPurchase, type Tab } from './progress';
  import { fmt } from './format';
  import { t } from './text';

  const tabs: Tab[] = ['battle', 'heroes', 'village', 'base', 'dungeons', 'guild', 'shop'];
  let tab: Tab = $state('battle');
</script>

<div class="top">
  <span>💰 {fmt(Number($save.gold))}</span>
  <span>⭐ {fmt($save.floorPoints)}</span>
  <span>💎 {$save.gems}</span>
  <span>🔮 {$save.crystals}</span>
</div>

<div class="dock">
<FloorStrip />
<div class="panel">
  {#if tab === 'battle'}<BattleTab />
  {:else if tab === 'heroes'}<HeroesTab />
  {:else if tab === 'village'}<VillageTab />
  {:else if tab === 'base'}<BaseTab />
  {:else if tab === 'dungeons'}<DungeonsTab />
  {:else if tab === 'guild'}<GuildTab />
  {:else}<ShopTab />{/if}
</div>
</div>

<nav>
  {#each tabs as k}
    <button class:active={tab === k} onclick={() => (tab = k)}>{t.screen[k]}{#if tabHasPurchase($save, k, Date.now(), !!$dungeonRun)}<i class="dot" role="img" aria-label={t.progress.dot}></i>{/if}</button>
  {/each}
</nav>

{#if $heroCard && $save.heroes[$heroCard]}<HeroCard id={$heroCard} onclose={() => heroCard.set(null)} />{/if}
<Toast />
<Popups />

<style>
  .top { position: absolute; top: 0; left: 0; right: 0; height: 40px; display: flex; justify-content: space-around; align-items: center; color: #fff; font: 14px monospace; background: #15152a; }
  /* Сцена боя занимает верх холста (земля на 420/640 = 65,6%); док начинается сразу под ней. */
  .dock { position: absolute; top: 66%; left: 0; right: 0; bottom: 56px; display: flex; flex-direction: column; background: #101020; }
  .panel { flex: 1; min-height: 0; overflow-x: hidden; overflow-y: auto; padding: 8px; color: #ddd; font: 13px monospace; background: #101020; }
  nav { position: absolute; bottom: 0; left: 0; right: 0; height: 56px; display: flex; background: #15152a; }
  nav button { position: relative; flex: 1; min-width: 0; background: none; border: 0; border-radius: 0; color: #888; font: 600 10px system-ui, sans-serif; padding: 0; overflow: hidden; }
  .dot { position: absolute; top: 6px; right: 6px; width: 8px; height: 8px; border-radius: 50%; background: #ff5252; }
  @media (max-width: 400px) { nav button { font-size: 9px; letter-spacing: -0.2px; } }
  nav button.active { color: #fff; border-top: 2px solid #ffd54f; }
  :global(button) { min-height: 40px; background: #2a2a44; color: #fff; border: 1px solid #444; border-radius: 4px; padding: 6px 10px; font: 12px monospace; }
  :global(button:disabled) { opacity: 0.4; }
  :global(.row) { display: flex; justify-content: space-between; align-items: center; gap: 6px; padding: 6px 0; border-bottom: 1px solid #222; }
  :global(.tile) { display: flex; gap: 8px; align-items: center; background: #16162b; border: 1px solid #2a2a44; border-radius: 6px; padding: 6px; margin-bottom: 6px; }
  :global(.warn) { color: #ff9f43; }
  :global(.muted) { color: #888; font-size: 11px; }
  :global(.stub) { color: #666; text-align: center; margin-top: 40px; }
</style>
