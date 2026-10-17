# Формат сейва (v2)

`GameState` из `src/sim/types.ts`. Хранится в localStorage (`rv-tycoon.save.v1`, JSON → lz-string base64) и в `saves.state` (jsonb) в Supabase. Золото — строка (Decimal), остальное — числа.

```json
{
  "v": 1,
  "savedAt": 1760712000000,
  "floor": 137, "maxFloor": 212, "runMaxFloor": 150,
  "gold": "4.21e19", "floorPoints": 3840, "crystals": 95, "petFood": 12, "gems": 40,
  "resources": { "bone": 1200, "leaf": 340, "ore": 0, "seal": 0, "totem": 0 },
  "heroes": { "morven": { "lvl": 184, "form": 2, "pet": 12, "artifacts": ["skull_lich"], "floorsInParty": 77 } },
  "artifacts": { "skull_lich": 7 },
  "perks": { "permGold": false },
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
-  — лучший этаж текущего забега (сбрасывается воскрешением); от него считаются кристаллы.  — рекорд за всё время (слоты отряда, яйца).
-  — этажей пройдено с героем в отряде (условие пробуждения: 50). : 0 — петомца нет, >=1 — уровень.
-  — купленные артефакты id → уровень 1..50; надетые лежат в  (не больше слотов героя).
-  — разовая покупка «золото ×1.1»;  — дата (локальная) последнего забранного дневного корма.
-  — локальная дата YYYY-MM-DD; при смене даты счётчики входов считаются нулевыми.
- Миграция : , , , ,  у всех героев.
