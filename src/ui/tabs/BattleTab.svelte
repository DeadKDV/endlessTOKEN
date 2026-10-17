<script lang="ts">
  import { save, dungeonRun, prestigeAsk, setCreepMixAction } from '../../game';
  import { prestigeGain } from '../../sim/prestige';
  import AdButtons from '../AdButtons.svelte';
  import { t, tpl } from '../text';
  import { artSet, setArtSet, ART_SETS } from '../../render/artSet';

  const art = artSet();

  const gain = $derived(prestigeGain($save));
</script>

<AdButtons />

<div class="row">
  <span>{t.battle.art}</span>
  <span class="art">
    {#each ART_SETS as a}
      <button class:on={a === art} onclick={() => a !== art && setArtSet(a)}>{t.battle.artSet[a]}</button>
    {/each}
  </span>
</div>

<div class="row">
  <span>{gain > 0 ? tpl(t.battle.prestigeGain, { n: gain }) : t.battle.prestigeLocked}</span>
  <button disabled={gain < 1 || !!$dungeonRun} onclick={() => prestigeAsk.set(true)}>{t.action.prestige}</button>
</div>

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

<style>
  .art { display: flex; gap: 4px; }
  .art button.on { border-color: #ffd54f; color: #ffd54f; }
  .mix { margin-top: 6px; display: grid; gap: 4px; }
  label { display: grid; grid-template-columns: 90px 1fr; align-items: center; gap: 6px; }
  input { width: 100%; }
</style>
