<script lang="ts">
  import { get } from 'svelte/store';
  import { save, battle, dungeonRun, enterRaid } from '../../game';
  import { buildParty, localDate } from '../../sim/party';
  import { RAID_ID, RAID_MAX_TICKS, raidDamage, raidEntriesLeft, raidRace, raidRewardOf, raidTiers, raidToday } from '../../sim/raid';
  import economy from '../../data/economy.json';
  import RaidBossPortrait from '../RaidBossPortrait.svelte';
  import { fmt } from '../format';
  import { rewardText } from '../raidText';
  import { t, tpl } from '../text';

  const R = economy.guild.raid;
  let now = $state(Date.now());
  $effect(() => { const i = setInterval(() => (now = Date.now()), 1000); return () => clearInterval(i); });
  const pad = (n: number) => String(n).padStart(2, '0');
  const untilReset = $derived.by(() => {
    const d = new Date(now);
    const s = Math.max(0, Math.ceil((new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime() - now) / 1000));
    return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
  });
  const race = $derived(raidRace(localDate(now)));
  const day = $derived(raidToday($save, now));
  const left = $derived(raidEntriesLeft($save, now));
  // ступени от DPS текущего отряда; пересчёт раз в секунду, а не на каждое изменение золота
  const tiers = $derived.by(() => { now; return raidTiers(buildParty(get(save))); });
  const inRaid = $derived($dungeonRun === RAID_ID && !!$battle);
  const timeLeft = $derived(inRaid ? Math.max(0, Math.ceil((RAID_MAX_TICKS - $battle!.tick) / 10)) : 0);
</script>

<section class="raid">
  <div class="head">
    <RaidBossPortrait {race} size={64} />
    <div class="info">
      <b>{t.raidDay.title}</b>
      <span>{tpl(t.raidDay.boss, { race: t.race[race] })}</span>
      <span class="muted">{tpl(t.raidDay.reset, { t: untilReset })}</span>
    </div>
    <div class="act">
      {#if inRaid}
        <span class="warn">{tpl(t.raidDay.timeLeft, { n: timeLeft })}</span>
        <span>{tpl(t.raidDay.damage, { n: fmt(raidDamage($battle!)) })}</span>
      {:else}
        <span class="muted">{tpl(t.raidDay.entries, { n: left, max: R.entries })}</span>
        <button disabled={left <= 0 || !!$dungeonRun} onclick={enterRaid}>{t.raidDay.go}</button>
      {/if}
    </div>
  </div>
  <div class="stats">
    <span>{t.raidDay.today}: <b class="have">{fmt(day.best)}</b></span>
    <span>{t.raidDay.record}: <b class="have">{fmt(day.record)}</b></span>
  </div>
  <div class="muted">{t.raidDay.tiers}</div>
  <ol class="tiers">
    {#each tiers as need, i}
      <li class:got={day.best >= need}>
        <span class="mark">{day.best >= need ? '✔' : i + 1}</span>
        <span class="need">{fmt(need)}</span>
        <span class="muted">{rewardText(raidRewardOf(i + 1))}</span>
      </li>
    {/each}
  </ol>
  <p class="muted">{t.raidDay.hint}</p>
</section>

<p class="muted foot">{t.raidDay.server}</p>

<style>
  .raid { border: 1px solid #2a2a44; border-radius: 6px; background: #16162b; padding: 8px; display: flex; flex-direction: column; gap: 6px; }
  .head { display: flex; gap: 8px; align-items: center; }
  .info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .act { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; text-align: right; }
  .stats { display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
  .have { color: #ffd54f; }
  .tiers { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 3px; }
  .tiers li { display: flex; gap: 8px; align-items: baseline; background: #101020; border: 1px solid #2a2a44; border-radius: 4px; padding: 3px 6px; opacity: 0.75; }
  .tiers li.got { opacity: 1; border-color: #8bc34a; }
  .mark { width: 14px; text-align: center; color: #8bc34a; }
  .need { min-width: 64px; color: #ffd54f; }
  p { margin: 0; }
  .foot { text-align: center; margin-top: 10px; }
</style>
