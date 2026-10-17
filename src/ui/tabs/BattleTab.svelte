<script lang="ts">
  import { save, dungeonRun, prestigeAsk, setCreepMixAction } from '../../game';
  import { prestigeGain } from '../../sim/prestige';
  import AdButtons from '../AdButtons.svelte';
  import { t, tpl } from '../text';

  const gain = $derived(prestigeGain($save));
</script>

<AdButtons />

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
  .mix { margin-top: 6px; display: grid; gap: 4px; }
  label { display: grid; grid-template-columns: 90px 1fr; align-items: center; gap: 6px; }
  input { width: 100%; }
</style>
