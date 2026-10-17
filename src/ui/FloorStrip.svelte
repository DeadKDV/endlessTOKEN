<script lang="ts">
  // Полоса прогресса этажа над панелью: до босса, лучший этаж, переключатель «Остаться на этаже».
  import { save, toggleAutoAdvance, questsOpen } from '../game';
  import { autoAdvanceOn } from '../save/autoAdvance';
  import economy from '../data/economy.json';
  import { floorsToBoss, questsDot } from './progress';
  import { t, tpl } from './text';

  const k = $derived(floorsToBoss($save.floor));
  const stay = $derived(!autoAdvanceOn($save));
  const pct = $derived(((economy.floor.bossEvery - k) / economy.floor.bossEvery) * 100);
</script>

<div class="strip">
  <div class="info">
    <span class="line">{tpl(k ? t.progress.toBoss : t.progress.boss, { n: $save.floor, k })} <span class="muted">· {tpl(t.progress.best, { n: $save.maxFloor })}</span></span>
    <span class="bar"><span style="width:{pct}%"></span></span>
  </div>
  <button class="quests" aria-label={t.quests.open} title={t.quests.open} onclick={() => questsOpen.set(true)}><span class="scroll"></span>{#if questsDot($save, Date.now())}<i class="dot" role="img" aria-label={t.quests.dot}></i>{/if}</button>
  <button class:on={stay} aria-pressed={stay} title={stay ? t.progress.stayTitle : t.progress.advanceTitle} onclick={toggleAutoAdvance}>{stay ? '⟳' : '▲'} {t.progress.stay}</button>
</div>

<style>
  .strip { flex: none; display: flex; align-items: center; gap: 8px; height: 44px; padding: 0 8px; background: #15152a; border-bottom: 1px solid #2a2a44; color: #ddd; font: 12px monospace; }
  .info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
  .line { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .bar { height: 5px; background: #0c0c1a; border-radius: 3px; overflow: hidden; }
  .bar span { display: block; height: 100%; background: #ffd54f; transition: width 0.3s; }
  button { flex: none; white-space: nowrap; }
  .quests { position: relative; width: 40px; padding: 0; }
  /* свиток: прямоугольник с «строками» текста */
  .scroll { display: block; width: 18px; height: 22px; margin: 0 auto; border: 2px solid #ffd54f; border-radius: 3px; background: repeating-linear-gradient(#ffd54f 0 2px, transparent 2px 5px) 3px 4px / 8px 14px no-repeat; }
  .dot { position: absolute; top: 4px; right: 4px; width: 8px; height: 8px; border-radius: 50%; background: #ff5252; }
  button.on { border-color: #ffd54f; color: #ffd54f; }
</style>
