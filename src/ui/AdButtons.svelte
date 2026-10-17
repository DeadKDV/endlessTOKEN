<script lang="ts">
  // Четыре рекламные кнопки. Провайдер stub показывает экран "RVPower" и выдаёт награду.
  import { save, addGold } from '../game';
  import { floorGold } from '../sim/economy';
  import economy from '../data/economy.json';
  import ru from '../data/i18n/ru.json';
  import { get } from 'svelte/store';

  let showing = $state<string | null>(null);
  const A = economy.ads;

  async function watch(kind: 'speed' | 'resources' | 'gems' | 'boost') {
    // TODO: при VITE_AD_PROVIDER !== 'stub' — показать ролик сети и ждать callback; награду выдаёт сервер (supabase/schema.sql: ad_rewards)
    showing = A.stubScreenText;
    await new Promise(r => setTimeout(r, A.stubScreenSec * 1000));
    showing = null;
    const now = Date.now();
    const s = get(save);
    if (kind === 'speed') save.update(x => ({ ...x, ads: { ...x.ads, speedUntil: Math.min(Math.max(now, x.ads.speedUntil) + A.speed.durationMin * 60e3, now + A.speed.maxStackMin * 60e3) } }));
    if (kind === 'boost') save.update(x => ({ ...x, ads: { ...x.ads, boostUntil: now + A.boost.durationMin * 60e3 } }));
    if (kind === 'gems') save.update(x => ({ ...x, gems: x.gems + A.gems.gems, ads: { ...x.ads, gemsToday: x.ads.gemsToday + 1 } }));
    if (kind === 'resources') { addGold(floorGold(s.floor) * A.resources.goldHoursOfFloor * 360); save.update(x => ({ ...x, floorPoints: x.floorPoints + A.resources.floorPoints, ads: { ...x.ads, resourcesToday: x.ads.resourcesToday + 1 } })); }
  }
</script>

<div class="ads">
  <button onclick={() => watch('speed')}>▶ {ru.ads.speed}</button>
  <button onclick={() => watch('resources')} disabled={$save.ads.resourcesToday >= A.resources.perDay}>▶ {ru.ads.resources}</button>
  <button onclick={() => watch('gems')} disabled={$save.ads.gemsToday >= A.gems.perDay}>▶ {ru.ads.gems}</button>
  <button onclick={() => watch('boost')}>▶ {ru.ads.boost}</button>
</div>

{#if showing}
  <div class="stubscreen"><h1>{showing}</h1></div>
{/if}

<style>
  .ads { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .stubscreen { position: fixed; inset: 0; background: #000; display: flex; align-items: center; justify-content: center; z-index: 10; }
  .stubscreen h1 { color: #ffd54f; font: bold 48px monospace; letter-spacing: 4px; }
</style>
