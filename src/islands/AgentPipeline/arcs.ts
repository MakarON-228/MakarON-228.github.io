// Дуги контекста над цепочкой deep research (SPEC.md §7.5): от агента, чьи выводы читают, к читающему; толщина —
// лимит compact_text из кода. Станция i стоит в центре своей ячейки: ячейка — UNIT единиц viewBox. По горизонтали
// полоса дуг высотой ARC_H лежит над станциями, по вертикали — полоса шириной ARC_W слева от них. SVG растягивается
// по длине цепочки (preserveAspectRatio="none"), поперёк — 1:1 с пикселями, так что дуги не сплющиваются по высоте.

export const UNIT = 100;
export const ARC_H = 64;
export const ARC_W = 48;

const center = (i: number) => UNIT * i + UNIT / 2;
/** Кубическая дуга с контрольными точками над концами поднимается на 3/4 их выноса. */
const lift = (from: number, to: number, room: number) => Math.min(room - 4, 10 + 8 * Math.abs(to - from)) / 0.75;

export function arcPath(from: number, to: number, vertical: boolean): string {
  if (vertical) {
    const c = ARC_W - lift(from, to, ARC_W);
    return `M ${ARC_W} ${center(from)} C ${c} ${center(from)}, ${c} ${center(to)}, ${ARC_W} ${center(to)}`;
  }
  const c = ARC_H - lift(from, to, ARC_H);
  return `M ${center(from)} ${ARC_H} C ${center(from)} ${c}, ${center(to)} ${c}, ${center(to)} ${ARC_H}`;
}

/** Толщина линии в пикселях: от 2.2 при 1 800 символах до 5 при 6 000. */
export const arcWidth = (limit: number) => 1 + limit / 1500;
