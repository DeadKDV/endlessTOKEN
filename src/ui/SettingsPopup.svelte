<script lang="ts">
  // Полноэкранный попап «Настройки»: язык, графика, звук, сохранение (экспорт/импорт), сброс, версия сборки.
  import { get } from 'svelte/store';
  import { save, settingsOpen } from '../game';
  import { serialize, parseImport, replaceSave } from '../save/storage';
  import { sound } from '../audio/sfx';
  import { artSet, setArtSet, ART_SETS } from '../render/artSet';
  import { LANGS, setLang } from './lang';
  import { t, tpl, lang } from './text';

  const art = artSet();
  const S = t.settings;

  let exported = $state('');
  let copyMsg = $state('');
  let exportArea: HTMLTextAreaElement | undefined = $state();

  async function doExport() {
    exported = serialize(get(save));
    copyMsg = '';
  }
  async function copy() {
    try { await navigator.clipboard.writeText(exported); copyMsg = S.copied; return; } catch { /* запасной путь ниже */ }
    exportArea?.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { /* выделено - скопируют вручную */ }
    copyMsg = ok ? S.copied : S.copyFail;
  }

  let importText = $state('');
  let importError = $state('');
  let importReady = $state(false);
  function checkImport() {
    const r = parseImport(importText);
    importError = r.ok ? '' : ({ empty: S.importEmpty, bad: S.importBad, newer: S.importNewer })[r.error];
    importReady = r.ok;
  }
  function doImport() {
    if (replaceSave(importText.trim())) location.reload();
    else { importError = S.failed; importReady = false; }
  }

  let resetStep = $state(0);
  let resetInput = $state('');
  let resetError = $state('');
  const resetOk = $derived(resetInput.trim().toLocaleUpperCase() === S.resetWord);
  function doReset() {
    if (resetOk && replaceSave()) location.reload();
    else resetError = S.failed;
  }
</script>

<div class="overlay" role="dialog" aria-label={S.title}>
  <header>
    <h3>{S.title}</h3>
    <button onclick={() => settingsOpen.set(false)}>{S.close}</button>
  </header>

  <div class="body">
    <div class="row">
      <span>{S.language}</span>
      <span class="seg">
        {#each LANGS as l}
          <button class:on={l === lang} onclick={() => l !== lang && setLang(l)}>{l === 'ru' ? 'Русский' : 'English'}</button>
        {/each}
      </span>
    </div>

    <div class="row">
      <span>{S.graphics}</span>
      <span class="seg">
        {#each ART_SETS as a}
          <button class:on={a === art} onclick={() => a !== art && setArtSet(a)}>{S.art[a]}</button>
        {/each}
      </span>
    </div>

    <div class="row">
      <span>{S.sound}</span>
      <span class="seg">
        <button class:on={$sound.on} onclick={() => sound.update(v => ({ ...v, on: !v.on }))}>{$sound.on ? S.soundOn : S.soundOff}</button>
        <input type="range" min="0" max="100" aria-label={S.sound} value={Math.round($sound.vol * 100)} disabled={!$sound.on}
          oninput={e => sound.update(v => ({ ...v, vol: +e.currentTarget.value / 100 }))} />
      </span>
    </div>

    <h4>{S.saveTitle}</h4>
    <div class="block">
      <button onclick={doExport}>{S.export}</button>
      {#if exported}
        <p class="muted">{S.exportHint}</p>
        <textarea readonly rows="4" bind:this={exportArea} value={exported} onfocus={e => e.currentTarget.select()}></textarea>
        <div class="line"><button onclick={copy}>{S.copy}</button><span class="muted">{copyMsg}</span></div>
      {/if}
    </div>

    <div class="block">
      <span>{S.import}</span>
      <p class="muted">{S.importHint}</p>
      <textarea rows="4" bind:value={importText} oninput={() => { importReady = false; importError = ''; }} aria-label={S.import}></textarea>
      {#if importError}<p class="err" role="alert">{importError}</p>{/if}
      {#if importReady}
        <p class="warn">{S.importConfirm}</p>
        <div class="line"><button class="danger" onclick={doImport}>{S.importYes}</button><button onclick={() => (importReady = false)}>{S.cancel}</button></div>
      {:else}
        <button onclick={checkImport} disabled={!importText.trim()}>{S.importLoad}</button>
      {/if}
    </div>

    <h4>{S.danger}</h4>
    <div class="block">
      {#if resetStep === 0}
        <button class="danger" onclick={() => (resetStep = 1)}>{S.reset}</button>
      {:else if resetStep === 1}
        <p class="warn">{S.resetWarn}</p>
        <div class="line"><button class="danger" onclick={() => (resetStep = 2)}>{S.resetNext}</button><button onclick={() => (resetStep = 0)}>{S.cancel}</button></div>
      {:else}
        <p class="warn">{tpl(S.resetType, { w: S.resetWord })}</p>
        <input type="text" class="word" bind:value={resetInput} autocomplete="off" aria-label={S.resetWord} />
        {#if resetError}<p class="err" role="alert">{resetError}</p>{/if}
        <div class="line"><button class="danger" disabled={!resetOk} onclick={doReset}>{S.resetGo}</button><button onclick={() => { resetStep = 0; resetInput = ''; }}>{S.cancel}</button></div>
      {/if}
    </div>

    <div class="build">{S.build} {__BUILD__} UTC</div>
  </div>
</div>

<style>
  .overlay { position: absolute; inset: 0; z-index: 36; display: flex; flex-direction: column; background: #101020; color: #ddd; font: 13px monospace; }
  header { flex: none; display: flex; justify-content: space-between; align-items: center; padding: 0 8px; height: 48px; background: #15152a; border-bottom: 1px solid #2a2a44; }
  h3 { margin: 0; color: #ffd54f; }
  h4 { margin: 14px 0 4px; color: #ffd54f; }
  .body { flex: 1; min-height: 0; overflow-y: auto; padding: 8px 12px 16px; }
  .seg { display: flex; gap: 4px; align-items: center; }
  .seg input[type=range] { width: 90px; min-height: 0; }
  .seg button.on { border-color: #ffd54f; color: #ffd54f; }
  .block { display: grid; gap: 6px; padding: 8px 0; border-bottom: 1px solid #222; justify-items: start; }
  .block p { margin: 0; }
  textarea, .word { width: 100%; box-sizing: border-box; background: #16162b; color: #ddd; border: 1px solid #2a2a44; border-radius: 4px; font: 11px monospace; padding: 6px; word-break: break-all; resize: vertical; }
  .word { font-size: 13px; min-height: 40px; }
  .line { display: flex; gap: 8px; align-items: center; }
  .err { color: #ff5252; }
  .danger { border-color: #ff5252; color: #ff8a80; }
  .build { margin-top: 14px; color: #666; font-size: 11px; text-align: center; }
</style>
