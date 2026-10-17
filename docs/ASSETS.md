# Ассеты: пиксель-арт

Основной источник — Elthen's Pixel Art Shop (itch.io): один автор, вид сбоку, анимации idle/movement/attack/damage/death. Лицензия: https://www.patreon.com/posts/27430241 (коммерческое использование разрешено, перепродажа — нет; проверить актуальную версию перед релизом).

## Что купить (бандлы)
| Для чего | Бандл | Ссылка |
| --- | --- | --- |
| Люди | Royal Army | https://itch.io/s/147115/royal-army-bundle |
| Гномы | Dwarves | https://itch.io/s/146681/dwarves-bundle |
| Орки | Orcs | https://itch.io/s/146983/orcs-bundle |
| Нежить | Undead #1–3 | https://itch.io/s/146675/undead-monsters-bundle-1 |
| Эльфы | Elven Archeress, Elven Assassin, Elven Archer & Warrior (отдельные паки) | https://elthen.itch.io/ |
| Петомцы | Animals #1, #2, Dragons, Magical Beasts | https://itch.io/s/146598/animals-bundle-1 |
| Мобы | Goblins, Kobolds, Bandits, Cultists, Lizardfolk, Ratfolk, Fishfolk, Demons, Ooze | — |
| Фоны | Tilesets bundle | https://itch.io/s/148217/tilesets-bundle |
| Эффекты, UI | Spell Effects, Spell Projectiles, Status Effects, Medieval UI | — |

## Пайплайн
1. Распаковать покупки в `src/assets/raw/<раса>/<юнит>/` (в git не коммитится).
2. `scripts/pack-atlas.mjs` (написать агенту): собрать все PNG расы в атлас 2048×2048 + JSON (формат PixiJS spritesheet). Выход — `public/atlases/<раса>.png|json`.
3. В `src/data/heroes/*.json` поле `sprite` заменить на имя кадра в атласе. Пока файла нет — рендер рисует прямоугольник цвета расы (`BattleView.drawUnit`).
4. Формы героя: 0 = Royal-версия, 1 = Elite-версия, 2 = Elite + спрайт петомца на слое над героем + сдвиг палитры (Pixi `ColorMatrixFilter` или замена 2–3 цветов).

## Чего у Elthen нет
Танк и маг эльфов — перекраска людей (Royal Knight / Royal Mage) в зелёно-золотую палитру или заказ художнику по описаниям `visual` из JSON.
