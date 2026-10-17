# Сборка атласов из бесплатных паков Elthen и Zerie Tiny RPG (src/assets/raw/, в git не лежат) в формат прото-слоя рендера:
# public/elthen/<id>.png + <id>.json (анимации f0..f2_idle/walk/attack/hurt/death, meta.anchors/charH/projectile/tint)
# и public/elthen/index.json. Спрайты Elthen нельзя раздавать отдельно - public/elthen/ в git не коммитится.
# Запуск: python scripts/build_elthen.py
import json, os, sys
sys.stdout.reconfigure(encoding="utf-8")
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'src', 'assets', 'raw', 'elthen')
RAW_ROOT = os.path.join(ROOT, 'src', 'assets', 'raw')
OUT = os.path.join(ROOT, 'public', 'elthen')

# лист, размер кадра и ряд каждой анимации (подсмотрено по листам глазами)
PACKS = {
    'dwarf':     ('dwarf/Dwarf Sprite Sheet 1.3v.png', 64, 32, dict(idle=0, walk=1, attack=2, hurt=6, death=7)),
    'gladiator': ('gladiator/Gladiator-Sprite Sheet.png', 32, 32, dict(idle=0, walk=1, attack=2, hurt=3, death=4)),
    'fadv':      ('female-adventurer/Adventurer Female Sprite Sheet.png', 32, 32, dict(idle=0, walk=1, attack=2, hurt=3, death=4)),
    'adv_bow':   ('adventurer/Adventurer Sprite Sheet v1.5.png', 32, 32, dict(idle=0, walk=1, attack=9, hurt=6, death=7)),
    'adv_cast':  ('adventurer/Adventurer Sprite Sheet v1.5.png', 32, 32, dict(idle=0, walk=1, attack=10, hurt=6, death=7)),
    'witch':     ('witch/Witch Sprite Sheet.png', 32, 32, dict(idle=0, walk=1, attack=2, hurt=3, death=4)),
    'ghoul':     ('ghoul/Ghoul Sprite Sheet.png', 32, 32, dict(idle=0, walk=1, attack=2, hurt=3, death=4)),
    'goblin':    ('goblin-king/Goblin King Sprite Sheet.png', 64, 64, dict(idle=0, walk=1, attack=2, hurt=6, death=7)),
    'fox':       ('fox/Fox Sprite Sheet.png', 32, 32, dict(idle=0, walk=1, attack=2, hurt=4, death=6)),
    'minotaur':  ('minotaur/Minotaur - Sprite Sheet.png', 96, 96, dict(idle=0, walk=1, attack=3, hurt=7, death=9)),
}

# Zerie: каждая анимация - отдельная лента кадров 100x100
def zerie(folder, name, attack='Attack01'):
    return ('strips', {'idle': f'{folder}/{name}_Idle.png', 'walk': f'{folder}/{name}_Walk.png', 'attack': f'{folder}/{name}_{attack}.png',
                       'hurt': f'{folder}/{name}_Hurt.png', 'death': f'{folder}/{name}_Death.png'}, 100, 100)
PACKS.update({
    'soldier':     zerie('zerie/p1/Tiny RPG Character Asset Pack 01 v2.0 -Free Soldier&Orc/Characters(100x100 split)/Soldier/Soldier', 'Soldier'),
    'soldier_bow': zerie('zerie/p1/Tiny RPG Character Asset Pack 01 v2.0 -Free Soldier&Orc/Characters(100x100 split)/Soldier/Soldier', 'Soldier', 'Attack03'),
    'orc':         zerie('zerie/p1/Tiny RPG Character Asset Pack 01 v2.0 -Free Soldier&Orc/Characters(100x100 split)/Orc/Orc', 'Orc'),
    'blood':       zerie('zerie/p2/Tiny RPG Character Asset Pack 02 -Free Demon_A&Blood Monster_A/Characters(100x100 split)/Blood Monster_A/Blood Monster_A', 'Blood Monster_A'),
    'demon':       zerie('zerie/p2/Tiny RPG Character Asset Pack 02 -Free Demon_A&Blood Monster_A/Characters(100x100 split)/Demon_A/Demon_A', 'Demon_A'),
})
# паки со своей внешностью расы - без перекраски
OWN_LOOK = {'dwarf', 'orc', 'ghoul', 'soldier', 'soldier_bow'}

# перекраска по расе (множитель цвета в PixiJS): у Elthen нет эльфов, орков и нежити-героев
TINT = {'human': None, 'dwarf': None, 'elf': 0xB8F0A8, 'orc': 0x9CD67A, 'undead': 0xB8B0D8}
# роль героя / тип крипа -> пак и снаряд
HERO_ROLE = {'tank': ('gladiator', None), 'fighter': ('fadv', None), 'ranger': ('adv_bow', 'arrow'),
             'mage': ('adv_cast', 'orb'), 'support': ('witch', 'heal')}
CREEP = {'infantry': ('gladiator', None), 'ranged': ('adv_bow', 'arrow'), 'healer': ('witch', 'heal')}
# свои паки у рас, где они есть
RACE_PACK = {('dwarf', 'tank'): 'dwarf', ('dwarf', 'fighter'): 'dwarf', ('dwarf', 'infantry'): 'dwarf',
             ('undead', 'fighter'): 'ghoul', ('undead', 'infantry'): 'ghoul',
             ('orc', 'tank'): 'orc', ('orc', 'fighter'): 'orc', ('orc', 'infantry'): 'orc',
             ('human', 'infantry'): 'soldier', ('human', 'ranged'): 'soldier_bow'}
# стрелок-гном с ружьём, гномий маг-инженер - пушка
PROJ = {'dorin': 'bullet', 'gizmo': 'cannon', 'dwarf_ranged': 'bullet'}
RACES = ['undead', 'elf', 'dwarf', 'human', 'orc']
# враги-монстры: мобы - гули, босс - король гоблинов, рейд-босс - минотавр (перекраска в цвет расы этажа)
MOB_TINT = {'undead': 0xC8C0E8, 'elf': 0xA8E8A0, 'dwarf': 0xE8C8A0, 'human': 0xF0B0B0, 'orc': 0x9CD67A}


def frames_of(im, fw, fh, row):
    out = []
    for c in range(im.width // fw):
        cell = im.crop((c * fw, row * fh, c * fw + fw, row * fh + fh))
        if cell.getbbox():
            out.append(cell)
    return out


def load(sheets, path):
    return sheets.setdefault(path, Image.open(os.path.join(RAW_ROOT if path.startswith('zerie/') else RAW, path)).convert('RGBA'))


def build(uid, pack, projectile, tint, sheets):
    path, fw, fh, rows = PACKS[pack] if PACKS[pack][0] != 'strips' else (None, PACKS[pack][2], PACKS[pack][3], PACKS[pack][1])
    if pack in OWN_LOOK:
        tint = None
    if path is None:
        anims = {k: frames_of(load(sheets, p), fw, fh, 0) for k, p in rows.items()}
    else:
        im = load(sheets, path)
        anims = {k: frames_of(im, fw, fh, r) for k, r in rows.items()}
    cols = max(len(v) for v in anims.values())
    atlas = Image.new('RGBA', (cols * fw, len(anims) * fh))
    frames, animations = {}, {}
    idle = anims['idle'][0].getbbox()
    ax, ay = (idle[0] + idle[2]) / 2 / fw, idle[3] / fh
    for r, (name, cells) in enumerate(anims.items()):
        names = []
        for c, cell in enumerate(cells):
            atlas.alpha_composite(cell, (c * fw, r * fh))
            key = f'{name}_{c}'
            frames[key] = {'frame': {'x': c * fw, 'y': r * fh, 'w': fw, 'h': fh}, 'sourceSize': {'w': fw, 'h': fh},
                           'spriteSourceSize': {'x': 0, 'y': 0, 'w': fw, 'h': fh}, 'anchor': {'x': ax, 'y': ay}}
            names.append(key)
        for f in range(3):  # у Elthen одна внешность на все три формы - отличие форм рисует рендер
            animations[f'f{f}_{name}'] = names
    atlas.save(os.path.join(OUT, f'{uid}.png'))
    meta = {'image': f'{uid}.png', 'format': 'RGBA8888', 'size': {'w': atlas.width, 'h': atlas.height}, 'scale': 1,
            'anchors': {f'f{f}': [ax, ay] for f in range(3)}, 'charH': {f'f{f}': idle[3] - idle[1] for f in range(3)}}
    if projectile:
        meta['projectile'] = projectile
    if tint:
        meta['tint'] = tint
    json.dump({'frames': frames, 'animations': animations, 'meta': meta}, open(os.path.join(OUT, f'{uid}.json'), 'w'))


def main():
    if not os.path.isdir(RAW):
        print('нет исходников Elthen в', RAW)
        return
    os.makedirs(OUT, exist_ok=True)
    sheets, ids = {}, []
    for race in RACES:
        for h in json.load(open(os.path.join(ROOT, 'src', 'data', 'heroes', f'{race}.json'), encoding='utf-8')):
            pack, proj = HERO_ROLE[h['role']]
            pack = RACE_PACK.get((race, h['role']), pack)
            build(h['id'], pack, PROJ.get(h['id'], proj), TINT[race], sheets)
            ids.append(h['id'])
        for t, (pack, proj) in CREEP.items():
            uid = f'{race}_{t}'
            build(uid, RACE_PACK.get((race, t), pack), PROJ.get(uid, proj), TINT[race], sheets)
            ids.append(uid)
        for ref, pack, proj in [('mob_melee', 'ghoul' if race == 'undead' else 'blood', None), ('mob_ranged', 'demon', 'orb'), ('boss', 'goblin', None), ('raid_boss', 'minotaur', None)]:
            uid = f'{race}_{ref}'
            build(uid, pack, proj, MOB_TINT[race], sheets)
            ids.append(uid)
    build('pet_fox', 'fox', None, None, sheets)  # петомец героя; расовую перекраску даёт рендер
    ids.append('pet_fox')
    json.dump({'ids': ids}, open(os.path.join(OUT, 'index.json'), 'w'))
    print('собрано атласов:', len(ids))


main()
