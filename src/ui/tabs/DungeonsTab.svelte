<script lang="ts">
  import { save, battle, dungeonRun, enterDungeon, buyArtifactAction, upgradeArtifactAction } from '../../game';
  import { DUNGEONS, DUNGEON_MAX_TICKS, dungeonUnlocked, runsLeft } from '../../sim/dungeons';
  import { buildingLevel, dungeonUnlockLevel } from '../../sim/buildings';
  import { ARTIFACTS, ARTIFACT_MAX_LEVEL, ARTIFACT_PRICE, artifactUpgradeCost } from '../../sim/artifacts';
  import { heroById } from '../../sim/party';
  import economy from '../../data/economy.json';
  import races from '../../data/races.json';
  import PixelIcon from '../PixelIcon.svelte';
  import { fmt } from '../format';
  import { t, tpl, artifactEffectText, nm } from '../text';

  const timeLeft = $derived($battle && $dungeonRun ? Math.max(0, Math.ceil((DUNGEON_MAX_TICKS - $battle.tick) / 10)) : 0);

  let now = $state(Date.now());
  $effect(() => { const i = setInterval(() => (now = Date.now()), 1000); return () => clearInterval(i); });
  const pad = (n: number) => String(n).padStart(2, '0');
  const untilReset = $derived.by(() => {
    const d = new Date(now);
    const s = Math.max(0, Math.ceil((new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime() - now) / 1000));
    return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
  });
  const raceColor = (r: string) => (races.races as Record<string, { palette: string[] }>)[r]?.palette[1] ?? '#888';
  const wearers = (aid: string) => Object.entries($save.heroes).filter(([, h]) => h.artifacts.includes(aid)).map(([hid]) => nm(heroById(hid)?.name).split(',')[0]);
  const portal = $derived(buildingLevel($save, 'portal'));
</script>

<div class="reset muted">{tpl(t.dungeonCard.reset, { t: untilReset })}</div>

{#each DUNGEONS as d (d.id)}
  {@const open = dungeonUnlocked($save, d.id)}
  {@const left = runsLeft($save, d.id, now)}
  <section class="dun" class:locked={!open}>
    <div class="card">
      <PixelIcon name={d.resource} dim={!open} />
      <div class="info">
        <b>{t.dungeon[d.id as 'crypt']}</b>
        <span class="muted">{tpl(t.dungeonUi.race, { name: t.race[d.race] })}</span>
        <span class="muted">{t.currency[d.resource]}: <span class="have">{fmt($save.resources[d.resource])}</span></span>
      </div>
      <div class="act">
        {#if !open}
          <span class="muted">{tpl(t.dungeonUi.lockedBy, { n: dungeonUnlockLevel(d.id) })}</span>
          <span class="muted">{tpl(t.dungeonCard.portalNow, { have: portal, n: dungeonUnlockLevel(d.id) })}</span>
        {:else if $dungeonRun === d.id}
          <span class="warn">{tpl(t.dungeonUi.timeLeft, { n: timeLeft })}</span>
        {:else}
          <span class="muted">{tpl(t.dungeonUi.runs, { n: left, max: economy.dungeons.runsPerDay })}</span>
          <button disabled={left <= 0 || !!$dungeonRun} onclick={() => enterDungeon(d.id)}>{t.action.enter}</button>
        {/if}
      </div>
    </div>
    <span class="race-bar" style:background={raceColor(d.race)}></span>

    {#if open}
      <details>
        <summary>{t.dungeonUi.store}</summary>
        <div class="grid">
          {#each ARTIFACTS.filter(a => a.branch === d.id) as a (a.id)}
            {@const lvl = $save.artifacts[a.id] ?? 0}
            {@const cost = lvl ? artifactUpgradeCost(lvl) : ARTIFACT_PRICE}
            {@const worn = wearers(a.id)}
            {@const cur = lvl ? artifactEffectText(a, lvl) : t.dungeonCard.notBought}
            {@const nxt = lvl >= ARTIFACT_MAX_LEVEL ? '' : artifactEffectText(a, lvl + 1)}
            <div class="art" class:maxed={lvl >= ARTIFACT_MAX_LEVEL} class:off={!lvl}>
              <div class="ahead">
                <PixelIcon name={a.resource} size={24} dim={!lvl} />
                <div class="aname"><b>{nm(a.name)}</b><span class="muted">{lvl ? tpl(t.dungeonUi.owned, { n: lvl, max: ARTIFACT_MAX_LEVEL }) : ''}</span></div>
              </div>
              <div class="muted">{cur}</div>
              {#if nxt && nxt !== cur}<div class="next">&rarr; {nxt}</div>{/if}
              <div class="muted worn">{worn.length ? tpl(t.dungeonCard.wornBy, { names: worn.join(', ') }) : lvl ? t.dungeonCard.notWorn : ''}</div>
              {#if lvl >= ARTIFACT_MAX_LEVEL}
                <div class="muted cap">{t.hero.maxed}</div>
              {:else}
                <button disabled={$save.resources[a.resource] < cost} onclick={() => (lvl ? upgradeArtifactAction(a.id) : buyArtifactAction(a.id))}>
                  {lvl ? t.action.upgrade : t.action.buy} &middot; {fmt(cost)}
                </button>
              {/if}
            </div>
          {/each}
        </div>
      </details>
    {/if}
  </section>
{/each}

<style>
  .reset { text-align: right; margin-bottom: 4px; }
  .dun { position: relative; border: 1px solid #2a2a44; border-radius: 6px; background: #16162b; padding: 6px; margin-bottom: 8px; overflow: hidden; }
  .locked { opacity: 0.6; }
  .card { display: flex; gap: 8px; align-items: center; }
  .info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
  .have { color: #ffd54f; }
  .act { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; text-align: right; max-width: 45%; }
  .race-bar { position: absolute; left: 0; top: 0; bottom: 0; width: 3px; }
  summary { cursor: pointer; color: #ffd54f; padding: 6px 0 2px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 6px; margin-top: 4px; }
  .art { display: flex; flex-direction: column; gap: 3px; min-width: 0; background: #101020; border: 1px solid #2a2a44; border-radius: 4px; padding: 6px; }
  .art button { margin-top: auto; }
  .ahead { display: flex; gap: 6px; align-items: center; }
  .aname { display: flex; flex-direction: column; min-width: 0; overflow-wrap: anywhere; }
  .next { color: #8bc34a; font-size: 11px; }
  .off { opacity: 0.85; }
  .maxed { opacity: 0.6; }
  .worn { min-height: 13px; }
  .cap { text-transform: uppercase; letter-spacing: 1px; text-align: center; padding: 10px 0; }
</style>
