# Схема данных (`src/data/*.json`)

Весь контент — JSON, код его только читает. Все числа здесь — стартовые значения для тюнинга.

## Hero (`heroes/<race>.json` — массив из 5)

```ts
interface Hero {
  id: string;            // slug, ключ в сейве
  race: Race;            // "undead" | "elf" | "dwarf" | "human" | "orc"
  role: Role;            // "tank" | "fighter" | "ranger" | "mage" | "support"
  name: { ru: string; en: string };
  base: { hp: number; atk: number; atkSpeed: number; crit: number; critDmg: number; range: number };
  forms: [Form, Form, Form]; // 0 базовая, 1 пробуждение, 2 союз
  pet: Pet;
}
interface Form {
  name: { ru: string; en: string };
  statMult: number;      // 1 / 1.8 / 3.2
  creeps: number;        // 4 / 6 / 10
  abilities: Ability[];  // НОВЫЕ способности этой формы (накопительно с предыдущими); объекты встроены прямо в hero JSON
  visual: string;        // описание для художника / промпта
  sprite: string;        // путь к спрайт-листу (может не существовать → заглушка)
}
interface Pet {
  id: string;
  name: { ru: string; en: string };
  visual: string;
  passive: Ability;      // открывается на 5 ур.
  // 3-я способность героя лежит в forms[2].abilities[0]
}
```

## Ability (встроены в heroes/*.json)

```ts
interface Ability {
  id: string;
  name: { ru: string; en: string };
  kind: AbilityKind;
  value?: number;        // множитель/доля/количество в зависимости от kind
  duration?: number;     // секунды
  cooldown?: number;     // секунды; 0 = пассивка
  targets?: number;      // для multi-target
  radius?: number;       // для AoE, в клетках
}
type AbilityKind =
  | "shield_party"        // щит на отряд, value = доля HP
  | "damage_single"       // value = множитель атаки
  | "damage_aoe"          // value = множитель атаки, radius
  | "damage_line"         // пробивает всех в линии
  | "damage_multi"        // targets случайных целей, value множитель
  | "slow"                // value = доля замедления
  | "stun"                // duration
  | "root"                // targets, duration
  | "knockback"
  | "heal_party"          // value = доля HP
  | "heal_creeps"         // value = доля HP
  | "lifesteal"           // value = доля нанесённого урона
  | "buff_party"          // value = множитель ко всем статам (или stat: "atk"|"hp"|"atkSpeed"|"range")
  | "debuff_enemies"      // value = множитель урона врагов
  | "invuln_creeps"       // duration
  | "invuln_party"        // duration
  | "revive_creeps"       // value = доля воскрешаемых (1 = все), hp = доля HP
  | "revive_self"         // раз за этаж
  | "summon"              // value = длительность жизни призванных
  | "stack_atk"           // value = +% за срабатывание, cap
  | "crit_all"            // duration: все атаки критуют
  | "time_stop"           // duration
  | "execute"             // value = множитель по целям ниже hpThreshold
  | "armor_break"         // value = доля брони
  | "mark_boss"           // value = множитель урона по боссу
  | "percent_hp_damage"   // value = доля суммарного HP врагов
  | "double_cast"         // следующая способность срабатывает дважды
  | "sacrifice_buff"      // cost = доля HP отряда, value = множитель урона
  | "ghost_creeps";       // мёртвые крипы возвращаются духами на duration
```

## Creep (`creeps.json`)

```ts
interface Creep { id: string; race: Race; type: "infantry"|"ranged"|"healer";
  name: {ru,en}; hp: number; atk: number; range: number; heal?: number; visual: string; sprite: string }
```

## Building (`buildings.json`)

```ts
interface Building { id: string; zone: "village"|"base"; name: {ru,en};
  maxLevel: number; costBase: number; costGrowth: number;   // cost = costBase * costGrowth^level
  effect: { kind: string; perLevel?: number; ... } }
```

## Artifact (`artifacts.json`)

```ts
interface Artifact { id: string; branch: Dungeon; name: {ru,en}; price: number;
  upgradeGrowth: 1.5; maxLevel: 50;
  effect: { kind: string; atLevel1: number; atLevel50: number } }   // линейная интерполяция по уровню
```

## Формат сейва — `docs/SAVE_FORMAT.md`
