<script lang="ts">
  import { toast } from '../game';

  let text = $state('');
  $effect(() => {
    const m = $toast; if (!m) return;
    text = m.text;
    const h = setTimeout(() => (text = ''), 2500);
    return () => clearTimeout(h);
  });
</script>

{#if text}<div class="toast" role="status">{text}</div>{/if}

<style>
  .toast { position: absolute; left: 50%; top: 56px; transform: translateX(-50%); z-index: 20; max-width: 90%; padding: 6px 12px; background: rgba(26, 26, 46, 0.92); border: 1px solid #ff9f43; border-radius: 6px; color: #ff9f43; font: 13px monospace; pointer-events: none; animation: fade 0.2s ease-out; }
  @keyframes fade { from { opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .toast { animation: none; } }
</style>
