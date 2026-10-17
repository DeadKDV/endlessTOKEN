/** Звук без файлов: синтез через WebAudio. Контекст создаётся по первому жесту, вкладка скрыта - тишина. */
import { writable, get } from 'svelte/store';

export type SfxName = 'sword' | 'arrow' | 'bullet' | 'orb' | 'heal' | 'crit' | 'death' | 'coin' | 'cast' | 'ult' | 'win' | 'lose' | 'base' | 'click';
export interface SoundSettings { on: boolean; vol: number }

const KEY = 'rv-tycoon.sound';
const MAX_PER_WINDOW = 3, WINDOW_MS = 100;

function load(): SoundSettings {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (v && typeof v.on === 'boolean' && typeof v.vol === 'number') return { on: v.on, vol: Math.min(1, Math.max(0, v.vol)) };
  } catch { /* приватный режим - значения по умолчанию */ }
  return { on: true, vol: 0.35 };
}

export const sound = writable<SoundSettings>(load());
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
const recent = new Map<SfxName, number[]>();

sound.subscribe(v => {
  try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* без сохранения */ }
  if (master && ctx) master.gain.value = v.on ? v.vol : 0;
});

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    const s = get(sound);
    master.gain.value = s.on ? s.vol : 0;
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
}

// Политика браузеров: звук разрешён только после жеста пользователя.
if (typeof window !== 'undefined') {
  for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, ensure, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) void ctx.suspend().catch(() => {}); else ensure();
  });
}

function tone(freq: number, end: number, dur: number, type: OscillatorType, vol: number, delay = 0) {
  const c = ctx!, t = c.currentTime + delay;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (end !== freq) o.frequency.exponentialRampToValueAtTime(Math.max(1, end), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master!);
  o.start(t); o.stop(t + dur + 0.02);
}

function noise(dur: number, vol: number, freq: number, q = 1, kind: BiquadFilterType = 'bandpass', delay = 0) {
  const c = ctx!, t = c.currentTime + delay;
  const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = noiseBuf; f.type = kind; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(master!);
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
}

const VOICES: Record<SfxName, () => void> = {
  sword: () => { noise(0.09, 0.5, 2800, 1.2); tone(180, 90, 0.08, 'square', 0.12); },
  arrow: () => { noise(0.12, 0.25, 1800, 2, 'highpass'); tone(900, 300, 0.1, 'triangle', 0.1); },
  bullet: () => { noise(0.07, 0.45, 1200, 0.8); tone(240, 60, 0.07, 'sawtooth', 0.14); },
  orb: () => { tone(500, 900, 0.16, 'sine', 0.16); tone(750, 1350, 0.16, 'sine', 0.07); },
  heal: () => { tone(660, 660, 0.18, 'sine', 0.13); tone(990, 990, 0.2, 'sine', 0.1, 0.07); },
  crit: () => { noise(0.1, 0.5, 4500, 1.5); tone(1200, 1900, 0.14, 'square', 0.12); tone(1800, 2400, 0.12, 'triangle', 0.1, 0.03); },
  death: () => { tone(300, 70, 0.22, 'sawtooth', 0.14); noise(0.18, 0.25, 500, 0.7, 'lowpass'); },
  coin: () => { tone(1320, 1320, 0.08, 'square', 0.08); tone(1760, 1760, 0.2, 'square', 0.08, 0.07); },
  cast: () => { tone(300, 800, 0.28, 'sawtooth', 0.1); noise(0.25, 0.2, 2000, 1.5); },
  ult: () => { tone(120, 700, 0.5, 'sawtooth', 0.16); tone(180, 1050, 0.5, 'square', 0.07); noise(0.5, 0.35, 900, 0.8); tone(80, 40, 0.5, 'sine', 0.3, 0.1); },
  win: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.22, 'square', 0.12, i * 0.11)); },
  lose: () => { [392, 330, 262, 196].forEach((f, i) => tone(f, f * 0.97, 0.3, 'triangle', 0.16, i * 0.16)); },
  base: () => { noise(0.8, 0.7, 300, 0.6, 'lowpass'); tone(90, 30, 0.8, 'sawtooth', 0.3); },
  click: () => { tone(1000, 700, 0.04, 'square', 0.07); },
};

/** Проиграть звук; без жеста пользователя, при выключенном звуке, скрытой вкладке или толпе одинаковых - молчит. */
export function sfx(name: SfxName) {
  if (!ctx || ctx.state !== 'running' || document.hidden || !get(sound).on) return;
  const now = performance.now();
  const r = (recent.get(name) ?? []).filter(t => now - t < WINDOW_MS);
  if (r.length >= MAX_PER_WINDOW) { recent.set(name, r); return; }
  r.push(now); recent.set(name, r);
  try { VOICES[name](); } catch { /* звук не критичен */ }
}
