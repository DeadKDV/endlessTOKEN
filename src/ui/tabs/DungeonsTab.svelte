<script lang="ts">
  import { save, battle, dungeonRun, enterDungeon, buyArtifactAction, upgradeArtifactAction } from '../../game';
  import { DUNGEONS, DUNGEON_MAX_TICKS, dungeonUnlocked, runsLeft } from '../../sim/dungeons';
  import { dungeonUnlockLevel } from '../../sim/buildings';
  import { ARTIFACTS, ARTIFACT_MAX_LEVEL, ARTIFACT_PRICE, artifactUpgradeCost } from '../../sim/artifacts';
  import economy from '../../data/economy.json';
  import { t, tpl, artifactEffectText, nm } from '../text';

  const timeLeft = $derived($battle && $dungeonRun ? Math.max(0, Math.ceil((DUNGEON_MAX_TICKS - $battle.tick) / 10)) : 0);
</script>

{#each DUNGEONS as d (d.id)}
  {@const open = dungeonUnlocked($save, d.id)}
  {@const left = runsLeft($save, d.id, Date.now())}
  <div class="dun">
    <div class="row">
      <span>
        <b>{t.dungeon[d.id as "crypt"]}</b>
        <span class="muted"> · {tpl(t.dungeonUi.race, { name: t.race[d.race] })} · {t.currency[d.resource]}: {$save.resources[d.resource]}</span>
      </span>
      {#if !open}
        <span class="muted">{tpl(t.dungeonUi.lockedBy, { n: dungeonUnlockLevel(d.id) })}</span>
      {:else if $dungeonRun === d.id}
        <span class="warn">{tpl(t.dungeonUi.timeLeft, { n: timeLeft })}</span>
      {:else}
        <span>
          <span class="muted">{tpl(t.dungeonUi.runs, { n: left, max: economy.dungeons.runsPerDay })}</span>
          <button disabled={left <= 0 || !!$dungeonRun} onclick={() => enterDungeon(d.id)}>{t.action.enter}</button>
        </span>
      {/if}
    </div>
    {#if open}
      <details>
        <summary>{t.dungeonUi.store}</summary>
        {#each ARTIFACTS.filter(a => a.branch === d.id) as a (a.id)}
          {@const lvl = $save.artifacts[a.id] ?? 0}
          <div class="row">
            <span>
              {nm(a.name)}{lvl ? ` · ${tpl(t.dungeonUi.owned, { n: lvl, max: ARTIFACT_MAX_LEVEL })}` : ''}<br />
              <span class="muted">{artifactEffectText(a, lvl)}</span>
            </span>
            {#if !lvl}
              <button disabled={$save.resources[a.resource] < ARTIFACT_PRICE} onclick={() => buyArtifactAction(a.id)}>{tpl(t.dungeonUi.buy, { n: ARTIFACT_PRICE })}</button>
            {:else if lvl >= ARTIFACT_MAX_LEVEL}
              <span class="muted">{t.hero.maxed}</span>
            {:else}
              <button disabled={$save.resources[a.resource] < artifactUpgradeCost(lvl)} onclick={() => upgradeArtifactAction(a.id)}>{tpl(t.dungeonUi.upgrade, { n: artifactUpgradeCost(lvl) })}</button>
            {/if}
          </div>
        {/each}
      </details>
    {/if}
  </div>
{/each}

<style>
  .dun { border-bottom: 1px solid #333; padding: 4px 0; }
  summary { cursor: pointer; color: #ffd54f; padding: 2px 0; }
</style>
