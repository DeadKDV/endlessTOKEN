<script lang="ts">
  import { save, heroCard } from '../game';
  import BattleTab from './tabs/BattleTab.svelte';
  import HeroesTab from './tabs/HeroesTab.svelte';
  import VillageTab from './tabs/VillageTab.svelte';
  import BaseTab from './tabs/BaseTab.svelte';
  import DungeonsTab from './tabs/DungeonsTab.svelte';
  import GuildTab from './tabs/GuildTab.svelte';
  import ShopTab from './tabs/ShopTab.svelte';
  import HeroCard from './HeroCard.svelte';
  import Popups from './Popups.svelte';
  import { fmt } from './format';
  import { t } from './text';

  const tabs = ['battle', 'heroes', 'village', 'base', 'dungeons', 'guild', 'shop'] as const;
  let tab: (typeof tabs)[number] = $state('battle');
</script>

<div class="top">
  <span>💰 {fmt(Number($save.gold))}</span>
  <span>⭐ {fmt($save.floorPoints)}</span>
  <span>💎 {$save.gems}</span>
  <span>🔮 {$save.crystals}</span>
</div>

<div class="panel">
  {#if tab === 'battle'}<BattleTab />
  {:else if tab === 'heroes'}<HeroesTab />
  {:else if tab === 'village'}<VillageTab />
  {:else if tab === 'base'}<BaseTab />
  {:else if tab === 'dungeons'}<DungeonsTab />
  {:else if tab === 'guild'}<GuildTab />
  {:else}<ShopTab />{/if}
</div>

<nav>
  {#each tabs as k}
    <button class:active={tab === k} onclick={() => (tab = k)}>{t.screen[k]}</button>
  {/each}
</nav>

{#if $heroCard && $save.heroes[$heroCard]}<HeroCard id={$heroCard} onclose={() => heroCard.set(null)} />{/if}
<Popups />

<style>
  .top { position: absolute; top: 0; left: 0; right: 0; height: 40px; display: flex; justify-content: space-around; align-items: center; color: #fff; font: 14px monospace; background: #15152a; }
  .panel { position: absolute; top: 69%; left: 0; right: 0; bottom: 56px; overflow-y: auto; padding: 8px; color: #ddd; font: 13px monospace; background: #101020; }
  nav { position: absolute; bottom: 0; left: 0; right: 0; height: 56px; display: flex; background: #15152a; }
  nav button { flex: 1; background: none; border: 0; color: #888; font: 11px monospace; padding: 0; }
  nav button.active { color: #fff; border-top: 2px solid #ffd54f; }
  :global(button) { background: #2a2a44; color: #fff; border: 1px solid #444; border-radius: 4px; padding: 6px 10px; font: 12px monospace; }
  :global(button:disabled) { opacity: 0.4; }
  :global(.row) { display: flex; justify-content: space-between; align-items: center; gap: 6px; padding: 6px 0; border-bottom: 1px solid #222; }
  :global(.warn) { color: #ff9f43; }
  :global(.muted) { color: #888; font-size: 11px; }
  :global(.stub) { color: #666; text-align: center; margin-top: 40px; }
</style>
