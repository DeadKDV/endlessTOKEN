<script lang="ts">
  // Четыре рекламные кнопки. Провайдер stub показывает экран "RVPower" и выдаёт награду.
  import { save, addGold, track } from '../game';
  import { floorGold } from '../sim/economy';
  import { localDate } from '../sim/party';
  import type { GameState } from '../sim/types';
  import economy from '../data/economy.json';
  import { t } from './text';
  import { get } from 'svelte/store';

  let showing = $state<string | null>(null);
  const A = economy.ads;
  let now = $state(Date.now());
  $effect(() => { const i = setInterval(() => (now = Date.now()), 1000); return () => clearInterval(i); });
  const mmss = (ms: number) => { const s = Math.ceil(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  // дневные лимиты сбрасываются в местную полночь, как подземелья
  const fresh = (ad: GameState['ads'], ms: number): GameState['ads'] => ad.day === localDate(ms) ? ad : { ...ad, resourcesToday: 0, gemsToday: 0, day: localDate(ms) };
  const cd = (at: number | undefined, min: number) => Math.max(0, (at ?? 0) + min * 60e3 - now);
  const items = $derived.by(() => {
    const ad = fresh($save.ads, now), speedLeft = ad.speedUntil - now, boostLeft = ad.boostUntil - now;
    const speedCd = cd(ad.speedAt, A.speed.cooldownMin), boostCd = cd(ad.boostAt, A.boost.cooldownMin);
    return [
      { k: 'speed' as const, label: t.ads.speedS, full: t.ads.speed, left: speedLeft, off: speedCd > 0, state: speedLeft > 0 ? mmss(speedLeft) : speedCd > 0 ? mmss(speedCd) : '×2' },
      { k: 'resources' as const, label: t.ads.resourcesS, full: t.ads.resources, left: 0, off: ad.resourcesToday >= A.resources.perDay, state: `${A.resources.perDay - ad.resourcesToday}/${A.resources.perDay}` },
      { k: 'gems' as const, label: t.ads.gemsS, full: t.ads.gems, left: 0, off: ad.gemsToday >= A.gems.perDay, state: `${A.gems.perDay - ad.gemsToday}/${A.gems.perDay}` },
      { k: 'boost' as const, label: t.ads.boostS, full: t.ads.boost, left: boostLeft, off: boostCd > 0, state: boostLeft > 0 ? mmss(boostLeft) : boostCd > 0 ? mmss(boostCd) : '+5%' },
    ];
  });

  async function watch(kind: 'speed' | 'resources' | 'gems' | 'boost') {
    // TODO: при VITE_AD_PROVIDER !== 'stub' — показать ролик сети и ждать callback; награду выдаёт сервер (supabase/schema.sql: ad_rewards)
    showing = A.stubScreenText;
    await new Promise(r => setTimeout(r, A.stubScreenSec * 1000));
    showing = null;
    track({ adsWatched: 1 });
    const now = Date.now();
    save.update(x => ({ ...x, ads: fresh(x.ads, now) }));
    const s = get(save);
    if (kind === 'speed') save.update(x => ({ ...x, ads: { ...x.ads, speedAt: now, speedUntil: Math.min(Math.max(now, x.ads.speedUntil) + A.speed.durationMin * 60e3, now + A.speed.maxStackMin * 60e3) } }));
    if (kind === 'boost') save.update(x => ({ ...x, ads: { ...x.ads, boostAt: now, boostUntil: now + A.boost.durationMin * 60e3 } }));
    if (kind === 'gems') save.update(x => ({ ...x, gems: x.gems + A.gems.gems, ads: { ...x.ads, gemsToday: x.ads.gemsToday + 1 } }));
    if (kind === 'resources') { addGold(floorGold(s.floor) * A.resources.goldHoursOfFloor * 360); save.update(x => ({ ...x, floorPoints: x.floorPoints + A.resources.floorPoints, ads: { ...x.ads, resourcesToday: x.ads.resourcesToday + 1 } })); }
  }
</script>

<div class="ads">
  {#each items as it (it.k)}
    <button class:active={it.left > 0} disabled={it.off} title={it.full} aria-label={it.full} onclick={() => watch(it.k)}>
      <span class="ic" aria-hidden="true">
        {#if it.k === 'speed'}<svg viewBox="0 0 24 24"><path d="M4 5l8 7-8 7zM12 5l8 7-8 7z" /></svg>
        {:else if it.k === 'resources'}<svg viewBox="0 0 24 24"><ellipse cx="12" cy="7" rx="7" ry="3" /><path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" fill="none" /></svg>
        {:else if it.k === 'gems'}<svg viewBox="0 0 24 24"><path d="M7 4h10l4 6-9 11L3 10z" /></svg>
        {:else}<svg viewBox="0 0 24 24"><path d="M12 3l7 8h-4v9H9v-9H5z" /></svg>{/if}
      </span>
      <span class="lb">{it.label}</span>
      <span class="st">{it.state}</span>
    </button>
  {/each}
</div>

{#if showing}
  <div class="stubscreen"><h1>{showing}</h1></div>
{/if}

<style>
  .ads { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; }
  .ads button { min-width: 0; min-height: 48px; padding: 3px 2px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; font-size: 10px; line-height: 1.1; }
  .ads .ic svg { display: block; width: 18px; height: 18px; fill: #ffd54f; stroke: #ffd54f; stroke-width: 1.6; stroke-linejoin: round; }
  .ads .lb { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #ccc; }
  .ads .st { color: #888; }
  .ads button.active { border-color: #ffd54f; background: #3a3320; }
  .ads button.active .st { color: #ffd54f; }
  .stubscreen { position: fixed; inset: 0; background: #000; display: flex; align-items: center; justify-content: center; z-index: 10; }
  .stubscreen h1 { color: #ffd54f; font: bold 48px monospace; letter-spacing: 4px; }
</style>
