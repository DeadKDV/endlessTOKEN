<script lang="ts">
  import { save, dungeonRun, prestigeAsk, setCreepMixAction } from '../../game';
  import { prestigeGain } from '../../sim/prestige';
  import AdButtons from '../AdButtons.svelte';
  import QuickLevel from '../QuickLevel.svelte';
  import { t, tpl } from '../text';

  const gain = $derived(prestigeGain($save));
  const KEY = 'et.battle.more';
  let open = $state((() => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } })());
  function toggle() { open = !open; try { localStorage.setItem(KEY, open ? '1' : '0'); } catch { /* без хранилища */ } }
</script>

<AdButtons />
<QuickLevel />

{#snippet prestige()}
  <div class="row" class:hot={gain > 0} data-tut="prestige">
    <span>{gain > 0 ? tpl(t.battle.prestigeGain, { n: gain }) : t.battle.prestigeLocked}</span>
    <button disabled={gain < 1 || !!$dungeonRun} onclick={() => prestigeAsk.set(true)}>{t.action.prestige}</button>
  </div>
{/snippet}

{#if gain > 0}{@render prestige()}{/if}

<button class="more" aria-expanded={open} onclick={toggle}>{open ? '▾' : '▸'} {t.battle.more}</button>
{#if open}
  {#if gain < 1}{@render prestige()}{/if}
  <div class="mix">
    <div class="muted">{t.battle.mix}</div>
    <label>{t.creepType.infantry} {Math.round($save.creepMix.infantry * 100)}%
      <input type="range" min="0" max="100" value={Math.round($save.creepMix.infantry * 100)}
        onchange={e => setCreepMixAction('infantry', +e.currentTarget.value / 100)} />
    </label>
    <label>{t.creepType.ranged} {Math.round($save.creepMix.ranged * 100)}%
      <input type="range" min="0" max="100" value={Math.round($save.creepMix.ranged * 100)}
        onchange={e => setCreepMixAction('ranged', +e.currentTarget.value / 100)} />
    </label>
    <div>{t.creepType.healer} {Math.round($save.creepMix.healer * 100)}%</div>
  </div>
{/if}

<style>
  .more { width: 100%; margin-top: 4px; text-align: left; background: none; border-color: #2a2a44; color: #aaa; }
  .hot { border: 1px solid #ffd54f; border-radius: 6px; padding: 6px; margin-top: 4px; background: #2a2614; }
  .mix { margin-top: 6px; display: grid; gap: 4px; }
  label { display: grid; grid-template-columns: 90px 1fr; align-items: center; gap: 6px; }
  input { width: 100%; min-height: 40px; }
</style>
