<script lang="ts">
  // Полноэкранный попап «Задания»: ежедневные (5 + сундук) и достижения со ступенями.
  import { save, questsOpen, claimDailyQuest, claimQuestChest, claimAchievementAction } from '../game';
  import { achievements, chestReady, CHEST_REWARD, dailyQuests, syncQuests, type Reward } from '../sim/quests';
  import { fmt } from './format';
  import { t, tpl } from './text';

  const num = (x: number) => (x >= 1e4 ? fmt(x) : String(Math.floor(x)));
  let tab: 'daily' | 'ach' = $state('daily');
  const s = $derived(syncQuests($save, Date.now()));
  const daily = $derived(dailyQuests(s));
  const ach = $derived(achievements(s));
  const doneCount = $derived(daily.filter(d => d.claimed).length);
  const kinds = t.quests.kind as Record<string, string>;
  const achNames = t.quests.ach as Record<string, string>;

  const rewardText = (r: Reward) => [
    r.gems && tpl(t.quests.reward.gems, { n: r.gems }),
    r.petFood && tpl(t.quests.reward.petFood, { n: r.petFood }),
    r.goldMin && tpl(t.quests.reward.gold, { n: r.goldMin }),
  ].filter(Boolean).join(', ');
</script>

<div class="overlay" role="dialog" aria-label={t.quests.title}>
  <header>
    <h3>{t.quests.title}</h3>
    <button onclick={() => questsOpen.set(false)}>{t.quests.close}</button>
  </header>
  <div class="tabs">
    <button class:on={tab === 'daily'} onclick={() => (tab = 'daily')}>{t.quests.daily}{#if daily.some(d => d.done && !d.claimed) || chestReady(s)}<i class="dot" role="img" aria-label={t.quests.dot}></i>{/if}</button>
    <button class:on={tab === 'ach'} onclick={() => (tab = 'ach')}>{t.quests.achievements}{#if ach.some(a => a.ready > 0)}<i class="dot" role="img" aria-label={t.quests.dot}></i>{/if}</button>
  </div>
  <div class="list">
    {#if tab === 'daily'}
      <p class="muted">{t.quests.resets}</p>
      {#each daily as q (q.id)}
        <div class="tile q">
          <div class="body">
            <b>{tpl(kinds[q.kind], { n: q.target })}</b>
            <span class="muted">{rewardText(q.reward)}</span>
            <span class="bar"><span style="width:{(q.progress / q.target) * 100}%"></span></span>
            <span class="muted">{num(q.progress)}/{num(q.target)}</span>
          </div>
          <button disabled={!q.done || q.claimed} onclick={() => claimDailyQuest(q.id)}>{q.claimed ? t.quests.claimed : t.quests.claim}</button>
        </div>
      {/each}
      <div class="tile q chest">
        <div class="body">
          <b>{t.quests.chest}</b>
          <span class="muted">{rewardText(CHEST_REWARD)} · {doneCount}/{daily.length}</span>
          <span class="muted">{t.quests.chestHint}</span>
        </div>
        <button disabled={!chestReady(s)} onclick={claimQuestChest}>{s.quests?.chestClaimed ? t.quests.claimed : t.quests.claim}</button>
      </div>
    {:else}
      {#each ach as a (a.id)}
        <div class="tile q">
          <div class="body">
            <b>{achNames[a.id]} <span class="muted">{a.claimed}/{a.steps.length}</span></b>
            {#if a.nextTarget !== null}
              <span class="muted">{tpl(t.quests.next, { n: num(a.nextTarget) })} · {tpl(t.quests.reward.gems, { n: a.gems[a.claimed] })}</span>
              <span class="bar"><span style="width:{Math.min(100, (a.value / a.nextTarget) * 100)}%"></span></span>
              <span class="muted">{num(a.value)}/{num(a.nextTarget)}</span>
            {:else}
              <span class="muted">{t.quests.allSteps}</span>
            {/if}
          </div>
          <button disabled={a.ready < 1} onclick={() => claimAchievementAction(a.id)}>{t.quests.claim}{a.ready > 1 ? ` ×${a.ready}` : ''}</button>
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .overlay { position: absolute; inset: 0; z-index: 35; display: flex; flex-direction: column; background: #101020; color: #ddd; font: 13px monospace; }
  header { flex: none; display: flex; justify-content: space-between; align-items: center; padding: 0 8px; height: 48px; background: #15152a; border-bottom: 1px solid #2a2a44; }
  h3 { margin: 0; color: #ffd54f; }
  .tabs { flex: none; display: flex; }
  .tabs button { position: relative; flex: 1; border-radius: 0; color: #888; }
  .tabs button.on { color: #fff; border-bottom: 2px solid #ffd54f; }
  .dot { position: absolute; top: 6px; right: 8px; width: 8px; height: 8px; border-radius: 50%; background: #ff5252; }
  .list { flex: 1; min-height: 0; overflow-y: auto; padding: 8px; }
  .q { justify-content: space-between; }
  .body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
  .bar { height: 5px; background: #0c0c1a; border-radius: 3px; overflow: hidden; }
  .bar span { display: block; height: 100%; background: #ffd54f; transition: width 0.3s; }
  .chest { border-color: #ffd54f; }
  p { margin: 0 0 6px; }
</style>
