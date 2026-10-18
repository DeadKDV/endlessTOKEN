<script lang="ts">
  // Быстрая прокачка отряда под боем (как в EF): карточки героев, цена, ▲ с автоповтором, общий ×1/×10/×max.
  import { save, levelUpHero } from '../game';
  import { heroLevelCost } from '../sim/economy';
  import { affordable } from '../sim/buildings';
  import { partySlots } from '../sim/heroes';
  import economy from '../data/economy.json';
  import HeroPortrait from './HeroPortrait.svelte';
  import HoldButton from './HoldButton.svelte';
  import { fmt } from './format';
  import { t, tpl, nm } from './text';
  import { heroById } from '../sim/party';

  const MODES: { v: number | 'max'; label: string }[] = [{ v: 1, label: t.hero.x1 }, { v: 10, label: t.hero.x10 }, { v: 'max', label: t.hero.xmax }];
  let mode = $state<number | 'max'>(1);

  const slots = $derived(partySlots($save.maxFloor));
  const locked = $derived(economy.party.slotsAtFloor.slice(Math.max(slots, $save.party.length)));

  // Цена и доступность выбранного шага; если не хватает даже на 1 уровень — показываем цену ближайшего.
  function price(lvl: number) {
    const a = affordable(heroLevelCost, lvl, Infinity, Number($save.gold), mode);
    return a.n > 0 ? { ok: true, cost: a.cost } : { ok: false, cost: heroLevelCost(lvl) };
  }
</script>

<div class="quick" data-tut="quick" aria-label={t.progress.quick}>
  {#each $save.party as id (id)}
    {@const h = $save.heroes[id]}
    {#if h}
      {@const p = price(h.lvl)}
      <div class="cell" class:ok={p.ok}>
        <HeroPortrait heroId={id} form={h.form} size={40} />
        <span class="muted">{tpl(t.level, { n: h.lvl })}</span>
        <span class="cost">{fmt(p.cost)}</span>
        <HoldButton label={tpl(t.progress.quickUp, { name: nm(heroById(id)?.name), mode: MODES.find(m => m.v === mode)?.label ?? '' })} disabled={!p.ok} onpress={() => levelUpHero(id, mode)}>▲</HoldButton>
      </div>
    {/if}
  {/each}
  {#each locked as f (f)}
    <div class="cell empty"><span class="plus">+</span><span class="muted">{tpl(t.battle.slotLocked, { n: f })}</span></div>
  {/each}
</div>
<div class="modes" role="group" aria-label={t.progress.quick}>
  {#each MODES as m (m.v)}
    <button class:on={mode === m.v} aria-pressed={mode === m.v} onclick={() => (mode = m.v)}>{m.label}</button>
  {/each}
</div>

<style>
  .quick { display: flex; gap: 4px; margin: 6px 0 4px; }
  .cell { flex: 1 1 0; max-width: 84px; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 2px; background: #16162b; border: 1px solid #2a2a44; border-radius: 6px; padding: 4px 2px; }
  .cell.ok { border-color: #ffd54f; box-shadow: 0 0 6px #ffd54f55; }
  .cost { font-size: 11px; color: #ffd54f; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .cell:not(.ok) .cost { color: #888; }
  .cell :global(button) { width: calc(100% - 4px); padding: 0; }
  .empty { justify-content: center; border-style: dashed; text-align: center; font-size: 9px; }
  .empty .muted { font-size: 9px; line-height: 1.1; }
  .plus { font-size: 20px; color: #444; }
  .modes { display: flex; gap: 4px; justify-content: center; margin-bottom: 6px; }
  .modes button { flex: 1; max-width: 90px; }
  .modes button.on { border-color: #ffd54f; color: #ffd54f; }
</style>
