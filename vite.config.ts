import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

export default defineConfig({
  // метка сборки внизу вкладки «Бой»: видно, обновилась ли игра у игрока
  define: { __BUILD__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ')) },
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'RV Tycoon',
        short_name: 'RV Tycoon',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0b0b12',
        theme_color: '#0b0b12',
        icons: [{ src: 'icon-512.png', sizes: '512x512', type: 'image/png' }],
      },
    }),
  ],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  build: { target: 'es2022' },
  test: { include: ['tests/**/*.test.ts'] },
});
