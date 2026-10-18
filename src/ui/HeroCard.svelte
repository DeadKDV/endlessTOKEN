<script lang="ts">
  // Полноэкранная карточка героя: статы, способности, петомец, формы, слоты артефактов.
  import {
    save, levelUpHero, feedPetAction, awakenHero, uniteHero, equipArtifactAction, unequipArtifactAction,
  } from '../game';
  import { heroLevelCost, creepCap } from '../sim/economy';
  import { heroById } from '../sim/party';
  import { feedCost } from '../sim/pets';
  import { canAwaken, canUnite } from '../sim/forms';
  import { artifactById, artifactSlots } from '../sim/artifacts';
  import economy from '../data/economy.json';
  import artifactData from '../data/artifacts.json';
  import HeroPortrait from './HeroPortrait.svelte';
  import BuyButtons from './BuyButtons.svelte';
  import { fmt } from './format';
  import { t, tpl, artifactEffectText, nm, lang } from './text';
  import { abilityText } from './abilityText';
  import { heroStatView } from './heroStats';
  import type { Ability } from '../sim/types';

  let { id, onclose }: { id: string; onclose: () => void } = $props();

  const def = $derived(heroById(id)!);
  const sv = $derived($save.heroes[id]);
  // статы — из buildParty (как в бою), mult — во сколько раз они выше, чем у героя без формы, петомца и артефактов
  const view = $derived(heroStatView($save, id));
  const stats = $derived(view.stats);
  const mult = (m: number) => (m > 1.005 ? ` ×${m.toFixed(2)}` : '');
  const creeps = $derived(creepCap(sv.form, sv.pet, $save.village.banner ?? 0));
  const slots = $derived(artifactSlots(sv.lvl));
  const spare = $derived(Object.keys($save.artifacts).filter(a => !sv.artifacts.includes(a)));
  const U = economy.hero.formUnlock;
</script>

{#snippet skill(a: Ability, open: boolean, tag: string, lock: string)}
  <div class="skill" class:locked={!open}>
    <div><b>{nm(a.name)}</b> <span class="muted">· {tag}</span></div>
    <div>{abilityText(a, lang)}</div>
    {#if !open}<div class="muted">{lock}</div>{/if}
  </div>
{/snippet}

<div class="card">
  <div class="head">
    <b>{nm(def.name)}</b>
    <button onclick={onclose}>{t.hero.close}</button>
  </div>
  <div class="tile">
    <HeroPortrait heroId={id} form={sv.form} size={96} />
    <div>{t.race[def.race as 'human']} · {t.role[def.role as 'tank']}<br />{tpl(t.level, { n: sv.lvl })} · {nm(def.forms[sv.form].name)}</div>
  </div>
  <div class="row">
    <span class="muted">{fmt(heroLevelCost(sv.lvl))} 💰</span>
    <BuyButtons can={Number($save.gold) >= heroLevelCost(sv.lvl)} onbuy={n => levelUpHero(id, n)} />
  </div>

  <h4>{t.hero.stats}</h4>
  <div class="grid" title={t.hero.statMult}>
    <span>{t.stat.hp}</span><span>{fmt(stats.hp)}<span class="muted">{mult(view.mult.hp)}</span></span>
    <span>{t.stat.atk}</span><span>{fmt(stats.atk)}<span class="muted">{mult(view.mult.atk)}</span></span>
    <span>{t.stat.atkSpeed}</span><span>{stats.atkSpeed.toFixed(2)}<span class="muted">{mult(view.mult.atkSpeed)}</span></span>
    <span>{t.stat.crit}</span><span>{Math.round(stats.crit * 100)}%</span>
    <span>{t.stat.critDmg}</span><span>×{stats.critDmg.toFixed(2)}</span>
    <span>{t.stat.range}</span><span>{stats.range}</span>
    <span>{tpl(t.hero.creeps, { n: creeps })}</span><span></span>
  </div>

  <h4>{t.hero.abilities}</h4>
  {#each def.forms as form, f}
    {#each form.abilities as a (a.id)}
      {@render skill(a as unknown as Ability, f <= sv.form, t.form[String(f) as '0'], tpl(t.hero.unlockForm, { name: t.form[String(f) as '0'] }))}
    {/each}
  {/each}
  {@render skill(def.pet.passive as unknown as Ability, sv.pet >= economy.pets.passiveAt, t.hero.petPassive, tpl(t.hero.unlockPet, { n: economy.pets.passiveAt }))}

  <h4>{t.hero.pet}</h4>
  {#if sv.pet < 1}
    <div class="muted">{t.hero.noPet}</div>
  {:else}
    <div class="row">
      <span>{nm(def.pet.name)} · {tpl(t.hero.petLevel, { n: sv.pet, max: economy.pets.maxLevel })}</span>
      {#if sv.pet >= economy.pets.maxLevel}
        <span class="muted">{t.hero.maxed}</span>
      {:else}
        <button disabled={$save.petFood < feedCost(sv.pet)} onclick={() => feedPetAction(id)}>{tpl(t.hero.feed, { n: feedCost(sv.pet) })}</button>
      {/if}
    </div>
    <div class="muted">{tpl(t.hero.petBonus, { p: Math.round((Math.pow(1 + economy.pets.statPerLevel, sv.pet) - 1) * 100), c: Math.floor(sv.pet / economy.pets.creepEveryLevels) })} · 🍖 {$save.petFood}</div>
  {/if}

  <h4>{t.hero.formsTitle}</h4>
  <div class="forms">
    {#each [0, 1, 2] as f}
      <div class="fcell">
        <HeroPortrait heroId={id} form={f} size={72} dim={f > sv.form} />
        <span class:muted={f > sv.form}>{nm(def.forms[f].name)}</span>
        {#if f > sv.form}
          <span class="muted">{f === 1
            ? tpl(t.hero.awakenNeed, { a: Math.min(sv.floorsInParty, U.awakening.floors), b: U.awakening.floors, c: Math.min($save.floorPoints, U.awakening.floorPoints), d: U.awakening.floorPoints })
            : tpl(t.hero.uniteNeed, { n: U.union.petLevel })}</span>
        {/if}
      </div>
    {/each}
  </div>

  <h4>{t.hero.formDone.replace('{name}', nm(def.forms[sv.form].name))}</h4>
  {#if sv.form === 0}
    <div class="row">
      <span class="muted">{tpl(t.hero.awakenNeed, { a: Math.min(sv.floorsInParty, U.awakening.floors), b: U.awakening.floors, c: Math.min($save.floorPoints, U.awakening.floorPoints), d: U.awakening.floorPoints })}</span>
      <button disabled={!canAwaken($save, id)} onclick={() => awakenHero(id)}>{t.hero.awaken}</button>
    </div>
  {:else if sv.form === 1}
    <div class="row">
      <span class="muted">{tpl(t.hero.uniteNeed, { n: U.union.petLevel })}</span>
      <button disabled={!canUnite($save, id)} onclick={() => uniteHero(id)}>{t.hero.unite}</button>
    </div>
  {/if}

  <h4>{t.hero.artifacts}</h4>
  {#each artifactData.slotsAtHeroLevel as need, i}
    <div class="row">
      {#if i < slots}
        {@const aid = sv.artifacts[i]}
        {#if aid}
          {@const a = artifactById(aid)!}
          <span>{nm(a.name)} · {artifactEffectText(a, $save.artifacts[aid])}</span>
          <button onclick={() => unequipArtifactAction(id, aid)}>{t.hero.unequip}</button>
        {:else}
          <span class="muted">{tpl(t.hero.slot, { n: i + 1 })}: {t.hero.empty}</span>
        {/if}
      {:else}
        <span class="muted">{tpl(t.hero.slot, { n: i + 1 })}: {tpl(t.hero.slotLocked, { n: need })}</span>
      {/if}
    </div>
  {/each}
  {#if slots > sv.artifacts.length}
    {#each spare as aid (aid)}
      {@const a = artifactById(aid)!}
      <div class="row">
        <span>{nm(a.name)} · {artifactEffectText(a, $save.artifacts[aid])}</span>
        <button onclick={() => equipArtifactAction(id, aid)}>{t.action.equip}</button>
      </div>
    {:else}
      <div class="muted">{t.hero.none}</div>
    {/each}
  {/if}
</div>

<style>
  .card { position: absolute; inset: 0; z-index: 20; overflow-y: auto; padding: 12px; background: #101020; color: #ddd; font: 13px monospace; }
  .head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 8px; }
  .forms { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
  .fcell { display: flex; flex-direction: column; align-items: center; gap: 3px; text-align: center; font-size: 11px; }
  .skill { padding: 4px 0; border-bottom: 1px solid #222; }
  .skill.locked { opacity: 0.45; }
  h4 { margin: 10px 0 4px; color: #ffd54f; }
</style>
