<script lang="ts">
  // Портрет героя в рамке: цвет расы, золото для формы 1, золото с аурой для формы 2.
  import { heroPortrait } from '../render/portraits';
  import { heroById } from '../sim/party';
  import races from '../data/races.json';

  let { heroId, form = 0, size = 48, dim = false }: { heroId: string; form?: number; size?: number; dim?: boolean } = $props();

  let src = $state('');
  const race = $derived(heroById(heroId)?.race ?? 'human');
  const color = $derived(form >= 1 ? '#ffd54f' : (races.races as Record<string, { palette: string[] }>)[race]?.palette[1] ?? '#888');

  $effect(() => {
    const id = heroId, f = form;
    let live = true;
    src = '';
    heroPortrait(id, f).then(u => { if (live) src = u; });
    return () => { live = false; };
  });
</script>

<span class="frame" class:aura={form >= 2} class:dim style="width:{size}px;height:{size}px;border-color:{color};--c:{color}">
  {#if src}<img {src} alt="" draggable="false" />{:else}<span class="sil"></span>{/if}
</span>

<style>
  .frame { box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; flex: none; padding: 3px; border: 2px solid; border-radius: 4px; background: #0c0c1a; }
  .aura { box-shadow: 0 0 8px 2px var(--c), inset 0 0 6px var(--c); }
  .dim img, .dim .sil { filter: brightness(0.3) saturate(0.4); }
  .dim { opacity: 0.8; }
  img { width: 100%; height: 100%; object-fit: contain; image-rendering: pixelated; }
  .sil { position: relative; width: 50%; height: 80%; background: #26263f; border-radius: 40% 40% 10% 10%; }
  .sil::before { content: ''; position: absolute; left: 25%; top: -22%; width: 50%; height: 38%; border-radius: 50%; background: #26263f; }
</style>
