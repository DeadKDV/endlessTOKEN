# Формат сейва (v7)

`GameState` из `src/sim/types.ts`. Хранится в localStorage (`rv-tycoon.save.v1`, JSON → lz-string base64) и в `saves.state` (jsonb) в Supabase. Золото — строка (Decimal), остальное — числа.

```json
{
  "v": 7,
  "savedAt": 1760712000000,
  "floor": 137, "maxFloor": 212, "runMaxFloor": 150,
  "gold": "4.21e19", "floorPoints": 3840, "crystals": 95, "petFood": 12, "gems": 40,
  "resources": { "bone": 1200, "leaf": 340, "ore": 0, "seal": 0, "totem": 0 },
  "heroes": { "morven": { "lvl": 184, "form": 2, "pet": 12, "artifacts": ["skull_lich"], "floorsInParty": 77 } },
  "artifacts": { "skull_lich": 7 },
  "perks": { "permGold": false, "starterPack": true },
  "autoAdvance": true,
  "quests": { "stats": { "floorsCleared": 310, "bossesKilled": 30, "levelsBought": 2400, "buildingLevels": 180, "prestiges": 2, "dungeonsRun": 9, "adsWatched": 14 }, "day": "2026-10-17", "dayStats": { "floorsCleared": 12, "bossesKilled": 1, "levelsBought": 40, "buildingLevels": 0, "prestiges": 0, "dungeonsRun": 0, "adsWatched": 1 }, "daily": ["floors:1", "bosses:0", "levels:1", "ads:0", "buildings:1"], "dailyClaimed": ["floors:1"], "chestClaimed": false, "ach": { "maxFloor": 4, "heroes": 2 } },
  "raid": { "date": "2026-10-17", "used": 2, "best": 3200000, "record": 5100000, "pending": false },
  "tutorial": { "done": ["level", "stay"], "skipped": false },
  "dailyFoodDay": "2026-10-17",
  "party": ["morven", "groul", "silva", "valtor", "mortis"],
  "village": { "barracks_undead": 61, "range": 14 },
  "base": { "mine": 88, "storage": 20, "portal": 25 },
  "creepMix": { "infantry": 0.5, "ranged": 0.3, "healer": 0.2 },
  "dungeonRuns": { "date": "2026-10-17", "crypt": 2 },
  "ads": { "speedUntil": 0, "boostUntil": 0, "resourcesToday": 1, "gemsToday": 0, "day": "2026-10-17" }
}
```

Миграции — словарь `migrations[v]` в `src/save/storage.ts`: при изменении схемы поднять `v`, добавить функцию v→v+1.
Конфликт локального и облачного сейва: берётся тот, где `savedAt` больше; при расхождении `maxFloor` > 20 этажей — показать игроку выбор.

## Изменения v1 → v2
- `runMaxFloor` — лучший этаж текущего забега (сбрасывается воскрешением); от него считаются кристаллы. `maxFloor` — рекорд за всё время (слоты отряда, яйца).
- `heroes[id].floorsInParty` — этажей пройдено с героем в отряде (условие пробуждения: 50). `pet`: 0 — петомца нет, >=1 — уровень.
- `artifacts` — купленные артефакты id → уровень 1..50; надетые лежат в `heroes[id].artifacts` (не больше слотов героя).
- `perks.permGold` — разовая покупка «золото ×1.1»; `dailyFoodDay` — дата (локальная) последнего забранного дневного корма.
- `dungeonRuns.date` — локальная дата YYYY-MM-DD; при её смене счётчики входов считаются нулевыми.
- Миграция `migrations[1]`: `runMaxFloor = maxFloor`, `artifacts = {}`, `perks.permGold = false`, `dailyFoodDay = ''`, `floorsInParty = 0` у всех героев.


## Изменения v2 → v3
- `perks.starterPack` — бесплатный стартовый набор уже получен (выдаётся один раз: самоцветы, золото, корм из `economy.gems.starterPack`).
- Миграция `migrations[2]`: `perks.starterPack = false`.

## Изменения v3 → v4
- `autoAdvance` — авто-проход этажей (кнопка «Остаться» над панелью). `false` — после победы отряд повторяет этаж: золото идёт, очки этажа, яйца и рост этажа — нет. Нет поля = включено. Тип дополнен в `src/save/autoAdvance.ts` (в `GameState` поле опционально).
- Миграция `migrations[3]`: `autoAdvance = true`. `newGameState()` отдаёт v3 без поля — `loadLocal` прогоняет его через `migrate`.

## Изменения v4 → v5
- `quests` (поле опционально, тип — в `src/sim/quests.ts`): `stats` — счётчики за всё время (этажи, боссы, купленные уровни героев, уровни зданий, воскрешения, пройденные подземелья, просмотренные ролики); `day` — локальная дата заданий, `dayStats` — те же счётчики за день; `daily` — id пяти заданий дня `вид:ступень` (данные в `src/data/quests.json`), `dailyClaimed` — забранные, `chestClaimed` — сундук дня; `ach` — достижение → сколько ступеней забрано. Лучший этаж и число героев в `stats` не дублируются — берутся из `maxFloor` и `heroes`.
- При смене даты (`syncQuests`, вызывается на первом событии/открытии попапа) задания генерируются заново по дате, `dayStats`/`dailyClaimed`/`chestClaimed` обнуляются.
- Миграция `migrations[4]`: `quests` = пустые счётчики; день и задания заполняются при первом событии.

## Изменения v5 → v6
- `tutorial` (поле опционально, тип — в `src/ui/tutorial.ts`): `done` — id закрытых подсказок обучения (`level`, `stay`, `village`, `quests`, `pet`, `prestige`), `skipped` — «Пропустить обучение» (подсказки больше не показываются). Нет поля = обучение не начато. Условия показа — в `TUTORIAL_STEPS`.
- Миграция `migrations[5]`: если игрок уже играл (`maxFloor > 1`, больше одного героя, золото > 0 или взят стартовый набор) — `{ done: [], skipped: true }`, иначе `{ done: [] }`. `newGameState()` по-прежнему отдаёт v3 и проходит через `migrate`, поэтому новая игра получает пустой прогресс.
- Прогресс в сейве, а не в localStorage: он едет вместе с облаком и импортом, а миграция отличает ветерана от новичка.

## Изменения v6 → v7
- `raid` (поле опционально, тип — `RaidSave` в `src/sim/raid.ts`): рейд дня. `date` — локальная дата, к которой относятся `used` (заходов потрачено из 3) и `best` (лучший урон за заход сегодня); при смене даты (`raidToday`) они считаются нулевыми. `record` — лучший урон за заход за всё время, не сбрасывается. `pending` — заход начат и ещё не засчитан: `settleRaid` выдаёт награду только при `pending: true` и сбрасывает флаг, поэтому награда один раз за заход.
- `quests.stats.raidsRun` / `quests.dayStats.raidsRun` — счётчик заходов в рейд (ежедневное задание «Сходить в рейд», вид `raids` в `quests.json`).
- Миграция `migrations[6]`: `raid` = нули (`date: ''`), `raidsRun: 0` в счётчиках заданий (если `quests` уже есть).
