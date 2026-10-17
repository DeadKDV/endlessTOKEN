<script lang="ts">
  // Облачко-подсказка обучения: привязано к элементу с data-tut, одно за раз; «Понятно» закрывает, «Пропустить» гасит всё.
  import { save, heroCard, questsOpen, dungeonRun, eggPopup, prestigeAsk, summonReveal, offlinePopup } from '../game';
  import { nextTutorialStep, dismissTutorialStep, skipTutorial, TUTORIAL_STEPS } from './tutorial';
  import { t, tpl } from './text';

  const step = $derived(nextTutorialStep($save));
  // поверх карточки, заданий и попапов подсказку не рисуем
  const busy = $derived(!!($heroCard || $questsOpen || $dungeonRun || $eggPopup || $prestigeAsk || $summonReveal || $offlinePopup));
  const text = $derived(step ? (t.tutorial.steps as Record<string, string>)[step.id] : '');
  const index = $derived(step ? TUTORIAL_STEPS.indexOf(step) + 1 : 0);

  let host: HTMLElement | undefined = $state();
  type Box = { x: number; y: number; w: number; h: number; sw: number; sh: number };
  let box = $state(null as Box | null);

  function measure() {
    if (!step || !host) { box = null; return; }
    const o = host.getBoundingClientRect();
    for (const a of step.anchors) {
      const el = document.querySelector(`[data-tut="${a}"]`);
      const r = el?.getBoundingClientRect();
      if (r && r.width > 0) { box = { x: r.left - o.left, y: r.top - o.top, w: r.width, h: r.height, sw: o.width, sh: o.height }; return; }
    }
    box = null;
  }

  $effect(() => {
    void step; void busy;
    measure();
    const iv = setInterval(measure, 400);
    addEventListener('resize', measure);
    return () => { clearInterval(iv); removeEventListener('resize', measure); };
  });

  const W = 244;
  const left = $derived(box ? Math.min(Math.max(box.x + box.w / 2 - W / 2, 8), box.sw - W - 8) : 0);
  const above = $derived(box ? box.y > 170 : true);
  const arrowX = $derived(box ? Math.min(Math.max(box.x + box.w / 2 - left, 14), W - 14) : 0);
  const pos = $derived(!box ? 'left:50%;bottom:72px;transform:translateX(-50%)'
    : above ? `left:${left}px;bottom:${box.sh - box.y + 10}px` : `left:${left}px;top:${box.y + box.h + 10}px`);
</script>

<div class="tut" bind:this={host}>
  {#if step && !busy}
    {#if box}<div class="ring" style="left:{box.x - 3}px;top:{box.y - 3}px;width:{box.w + 6}px;height:{box.h + 6}px"></div>{/if}
    <div class="bubble" style="width:{W}px;{pos}" role="status">
      {#if box}<i class="arrow" class:down={above} style="left:{arrowX}px"></i>{/if}
      <div class="muted">{tpl(t.tutorial.step, { n: index, max: TUTORIAL_STEPS.length })}</div>
      <div class="text">{text}</div>
      <div class="btns">
        <button class="skip" onclick={() => save.update(skipTutorial)}>{t.tutorial.skip}</button>
        <button class="ok" onclick={() => save.update(s => dismissTutorialStep(s, step.id))}>{t.tutorial.got}</button>
      </div>
    </div>
  {/if}
</div>

<style>
  .tut { position: absolute; inset: 0; z-index: 30; pointer-events: none; }
  .ring { position: absolute; border: 2px solid #ffd54f; border-radius: 6px; box-shadow: 0 0 10px #ffd54f; animation: pulse 1.2s ease-in-out infinite; }
  .bubble { position: absolute; box-sizing: border-box; pointer-events: auto; padding: 8px 10px; background: #1d1d38; border: 1px solid #ffd54f; border-radius: 8px; color: #eee; font: 12px/1.35 monospace; box-shadow: 0 4px 14px #000a; }
  .text { margin: 4px 0 8px; }
  .btns { display: flex; justify-content: space-between; align-items: center; gap: 6px; }
  .skip { background: none; border: 0; color: #888; font-size: 11px; padding: 0; text-decoration: underline; }
  .ok { border-color: #ffd54f; color: #ffd54f; }
  .arrow { position: absolute; width: 10px; height: 10px; background: #1d1d38; border: 1px solid #ffd54f; transform: translateX(-50%) rotate(45deg); }
  .arrow.down { bottom: -6px; border-top: 0; border-left: 0; }
  .arrow:not(.down) { top: -6px; border-bottom: 0; border-right: 0; }
  @keyframes pulse { 50% { opacity: 0.5; } }
  @media (prefers-reduced-motion: reduce) { .ring { animation: none; } }
</style>
