import { mount } from 'svelte';
import App from './ui/App.svelte';
import { BattleView } from './render/BattleView';
import { battle, boot, update } from './game';
import { get } from 'svelte/store';

const stage = document.getElementById('stage')!;
const view = new BattleView();
await view.init(stage);
mount(App, { target: stage });
boot();

let last = performance.now();
function frame(now: number) {
  update(Math.min(250, now - last));
  last = now;
  const b = get(battle);
  if (b) view.render(b);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
