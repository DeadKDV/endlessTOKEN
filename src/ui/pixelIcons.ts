// Пиксельные иконки 8x8: символ сетки → цвет палитры [a, b, c, d]; '.' — пусто.
export interface PixelIconDef { grid: string[]; pal: [string, string, string, string] }

export const ICONS: Record<string, PixelIconDef> = {
  barracks: { pal: ['#2e6fa3', '#1b3b5a', '#cfd8dc', '#ffd54f'], grid: ['.....dd.', '.....d..', '...aaa..', '..aaaaa.', '.aaabaaa', 'aaaabaaa', 'aaabbbaa', 'aaabbbaa'] },
  range: { pal: ['#c0392b', '#222222', '#eeeeee', '#ffd54f'], grid: ['..aaaa..', '.acccca.', 'acaaaaca', 'acaddaca', 'acaddaca', 'acaaaaca', '.acccca.', '..aaaa..'] },
  infirmary: { pal: ['#e53935', '#7f1d1d', '#ffffff', '#ffffff'], grid: ['..bbbb..', '..baab..', 'bbbaabbb', 'baaaaaab', 'baaaaaab', 'bbbaabbb', '..baab..', '..bbbb..'] },
  banner: { pal: ['#c0392b', '#7f1d1d', '#ffd54f', '#8d6e63'], grid: ['daaaaa..', 'daaaaaa.', 'daaccaaa', 'daaaaaa.', 'daaaaa..', 'd.......', 'd.......', 'dddd....'] },
  mine: { pal: ['#9e9e9e', '#616161', '#ffd54f', '#8d6e63'], grid: ['.cccccc.', 'cc.dd.cc', 'c..dd..c', '...dd...', '...dd...', '...dd...', '...dd...', '...dd...'] },
  storage: { pal: ['#8d6e63', '#4e342e', '#a1887f', '#ffd54f'], grid: ['bbbbbbbb', 'babaabab', 'baabbaab', 'baabbaab', 'baabbaab', 'baabbaab', 'babaabab', 'bbbbbbbb'] },
  tavern: { pal: ['#ffb300', '#6d4c41', '#ffffff', '#cfd8dc'], grid: ['.cccccc.', '.cccccc.', '.aaaaaad', '.aaaaa.d', '.aaaaa.d', '.aaaaaad', '.aaaaa..', '..bbb...'] },
  kennel: { pal: ['#a1887f', '#4e342e', '#d7ccc8', '#212121'], grid: ['...bb...', '..baab..', '.baaaab.', 'baaaaaab', 'aaaaaaaa', 'aabbbbaa', 'aabddbaa', 'aabddbaa'] },
  portal: { pal: ['#7e57c2', '#311b92', '#b388ff', '#e1bee7'], grid: ['..bbbb..', '.baaaab.', 'baccccab', 'bacddcab', 'bacddcab', 'bacddcab', 'bacddcab', 'bbbbbbbb'] },
  bone: { pal: ['#d9d2c5', '#8d8577', '#eeeeee', '#000000'], grid: ['........', 'aa....aa', 'aaaaaaaa', 'bbbbbbbb', 'aaaaaaaa', 'aa....aa', '........', '........'] },
  leaf: { pal: ['#7bd36b', '#2e7d32', '#c5e1a5', '#8d6e63'], grid: ['.....aaa', '...aaaaa', '..aaabaa', '.aaabaaa', '.aabaaa.', '.abaaa..', 'db......', 'd.......'] },
  ore: { pal: ['#4fc3f7', '#0277bd', '#b3e5fc', '#ffffff'], grid: ['...cc...', '..caac..', '.caaaac.', 'caaaaaac', 'baaaaaab', '.baaaab.', '..bbbb..', '........'] },
  seal: { pal: ['#b71c1c', '#7f1d1d', '#ffd54f', '#000000'], grid: ['..aaaa..', '.aaaaaa.', 'aaabbaaa', 'aabccbaa', 'aabccbaa', 'aaabbaaa', '.aaaaaa.', '..aaaa..'] },
  totem: { pal: ['#8d6e63', '#3e2723', '#ffffff', '#c0392b'], grid: ['..bbbb..', '.baaaab.', '.bdaadb.', '.baaaab.', '.bdddab.', '.baaaab.', '.baaaab.', '..bbbb..'] },
};

/** Один прямоугольник на пиксель; соседние одного цвета по строке склеены. */
export function iconRects(def: PixelIconDef, tint?: string): { x: number; y: number; w: number; fill: string }[] {
  const out: { x: number; y: number; w: number; fill: string }[] = [];
  def.grid.forEach((row, y) => {
    for (let x = 0; x < row.length;) {
      const k = row[x];
      if (k === '.') { x++; continue; }
      let w = 1; while (row[x + w] === k) w++;
      out.push({ x, y, w, fill: tint && k === 'a' ? tint : def.pal['abcd'.indexOf(k)] });
      x += w;
    }
  });
  return out;
}
