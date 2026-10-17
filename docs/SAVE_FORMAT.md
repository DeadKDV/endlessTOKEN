# Формат сейва (v4)

`GameState` из `src/sim/types.ts`. Хранится в localStorage (`rv-tycoon.save.v1`, JSON → lz-string base64) и в `saves.state` (jsonb) в Supabase. Золото — строка (Decimal), остальное — числа.

```json
{
  "v": 5,
  "savedAt": 1760712000000,
  "floor": 137, "maxFloor": 212, "runMaxFloor": 150,
  "gold": "4.21e19", "floorPoints": 3840, "crystals": 95, "petFood": 12, "gems": 40,
  "resources": { "bone": 1200, "leaf": 340, "ore": 0, "seal": 0, "totem": 0 },
  "heroes": { "morven": { "lvl": 184, "form": 2, "pet": 12, "artifacts": ["skull_lich"], "floorsInParty": 77 } },
  "artifacts": { "skull_lich": 7 },
  "perks": { "permGold": false, "starterPack": true },
  "autoAdvance": true,
  "quests": { "stats": { "floorsCleared": 310, "bossesKilled": 30, "levelsBought": 2400, "buildingLevels": 180, "prestiges": 2, "dungeonsRun": 9, "adsWatched": 14 }, "day": "2026-10-17", "dayStats": { "floorsCleared": 12, "bossesKilled": 1, "levelsBought": 40, "buildingLevels": 0, "prestiges": 0, "dungeonsRun": 0, "adsWatched": 1 }, "daily": ["floors:1", "bosses:0", "levels:1", "ads:0", "buildings:1"], "dailyClaimed": ["floors:1"], "chestClaimed": false, "ach": { "maxFloor": 4, "heroes": 2 } },
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
