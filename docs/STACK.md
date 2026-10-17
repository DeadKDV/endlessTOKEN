# Стек и архитектура

| Слой | Выбор | Почему |
| --- | --- | --- |
| Язык и сборка | TypeScript 5, Vite 6, pnpm/npm | Типы на формулах, HMR при тюнинге |
| Рендер боя | PixiJS 8 | Сотни спрайтов при 60 fps на телефоне |
| UI | Svelte 5 (runes) поверх канваса | Малый бандл, встроенные сторы |
| Состояние | Один `GameState` в svelte store, иммутабельные апдейты | Сейв = сериализация объекта |
| Большие числа | `break_infinity.js` (подключить, когда gold > 1e300) | Поздние этажи |
| Симуляция | `src/sim/`, тик 100 мс, mulberry32 по seed | Детерминизм для сервера |
| Сохранение | localStorage + lz-string; Supabase `saves` | Оффлайн и облако |
| Ассеты | PNG из Elthen → атласы (free-tex-packer) | см. ASSETS.md |
| Аудио | Howler.js | iOS Safari |
| PWA | vite-plugin-pwa | Иконка на экране, оффлайн |
| Хостинг | Cloudflare Pages | Бесплатно, свой домен |
| Бэкенд | Supabase: Auth (anonymous → email), Postgres, Edge Functions, Realtime | Облачный сейв, античит, гильдии |
| Тесты | Vitest на `sim/` | Баланс ломается молча |

## Правила
- `src/sim/` не импортирует `render/`, `ui/`, `save/`. Только `data/*.json`.
- Контент — в JSON (`src/data/`), не в коде.
- Серверная валидация боёв использует тот же `sim/` (Edge Function на Deno импортирует `src/sim/*.ts` напрямую).
- Все награды, кулдауны рекламы и престиж проходят через Edge Functions; клиент только отображает.

## Edge Functions (Deno, `supabase/functions/`)
| Функция | Вход | Что делает |
| --- | --- | --- |
| grant_ad_reward | kind, provider_ref? | Проверяет лимиты по `ad_rewards`, пишет запись, возвращает награду |
| apply_prestige | state | Проверяет maxFloor против прошлого сейва, считает кристаллы, пишет `prestige_log` |
| submit_raid_hit | raid_id, seed, party, damage | Пересчитывает по `sim/`, принимает при расхождении < 2% |
| submit_war_attack | war_id, defender_id, seed | Автобой атакующего против `war_defenses`, пишет результат и очки |
| create_guild / join_guild | name / guild_id | Списывает цену, создаёт записи |
| cron: open_raid (daily 00:00 UTC), matchmake_wars (mon 00:00 UTC) | — | Создают `raids`/`wars` |
