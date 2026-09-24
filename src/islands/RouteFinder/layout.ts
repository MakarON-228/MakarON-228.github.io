// Раскладка графа реакций для RouteFinder (SPEC.md §7.8): столбцы — слои от сырья к α-Al₂O₃, строки подобраны
// вручную так, чтобы линии шли горизонтально и поворачивали под 45°/90°, как на схеме метро (§4).
// Реакции с несколькими исходниками (7 и 12) рисуются веткой от каждого исходника.
import { reactions } from '../../data/demo/alumina-reactions';

export const WIDTH = 860;
export const HEIGHT = 456;

const X = [70, 210, 350, 490, 630, 780] as const;
const ROW = 54;
const y = (row: number) => 44 + row * ROW;

/** Где подпись относительно станции. */
export type Place = 'above' | 'right' | 'above-right' | 'below';

export interface NodeLayout {
  x: number;
  y: number;
  place: Place;
}

type Point = readonly [number, number];

// Сырьё (столбец 0) подписано над станцией; остальные — сверху справа: слева к ним приходят ветки и диагонали.
const at = (col: number, row: number): NodeLayout => ({ x: X[col]!, y: y(row), place: col === 0 ? 'above' : 'above-right' });

export const nodes: Readonly<Record<number, NodeLayout>> = {
  15: at(0, 0), // диаспор
  8: at(0, 1), // байерит
  9: at(1, 1), // η
  10: at(0, 2), // нордстрандит
  11: at(1, 2), // ρ
  12: at(2, 2), // γ(η)
  1: at(4, 2), // θ
  2: { ...at(5, 2), place: 'right' }, // α: сверху и снизу — вертикали
  3: at(0, 3), // гиббсит
  4: at(1, 3), // χ
  5: at(2, 3), // κ
  13: at(0, 4), // аморфный
  14: at(1, 4), // бёмит
  16: at(2, 4), // γ
  17: { ...at(3, 4), place: 'below' }, // δ: справа вверх уходит диагональ к θ
  19: at(0, 6), // Al₂O₃
  20: { ...at(1, 7), place: 'right' }, // i
};

const p = (id: number): Point => [nodes[id]!.x, nodes[id]!.y];

/** Ломаная от `a` к `b`: по строке `a`, затем диагональ 45° в строку `b` перед самой станцией. */
function diagonal(a: number, b: number): Point[] {
  const [x1, y1] = p(a);
  const [x2, y2] = p(b);
  return [
    [x1, y1],
    [x2 - Math.abs(y2 - y1), y1],
    [x2, y2],
  ];
}

/** Трассы, которые не укладываются в «прямо или диагональ». */
const special: Record<string, Point[]> = {
  // диаспор → α: поверху, затем вниз в α
  '14:15': [p(15), [X[5], y(0)], p(2)],
  // бёмит → α (гидротермально): под строкой γ–δ, затем вверх в α
  '18:14': [p(14), [X[1] + ROW, y(5)], [X[5], y(5)], p(2)],
  // Al₂O₃ → γ: по строке Al₂O₃, затем вверх на две строки
  '19:19': [p(19), [X[2] - 2 * ROW, y(6)], p(16)],
  // δ → θ: по строке δ, затем вверх на две строки
  '17:17': [p(17), [X[4] - 2 * ROW, y(4)], p(1)],
};

export interface EdgeLayout {
  reaction: number;
  source: number;
  points: Point[];
}

/** Ребро на каждый исходник каждой реакции. */
export const edges: readonly EdgeLayout[] = reactions.flatMap((r) =>
  r.sources.map((source) => {
    const [x1, y1] = p(source);
    const [, y2] = p(r.target);
    const points = special[`${r.id}:${source}`] ?? (y1 === y2 ? [p(source), p(r.target)] : diagonal(source, r.target));
    return { reaction: r.id, source, points: [[x1, y1] as Point, ...points.slice(1)] };
  }),
);

/** Путь SVG по ломаной со скруглёнными углами. */
export function roundedPath(points: readonly Point[], radius = 12): string {
  let d = `M${points[0]![0]} ${points[0]![1]}`;
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i - 1]!;
    const [cx, cy] = points[i]!;
    const [nx, ny] = points[i + 1]!;
    const lin = Math.hypot(cx - px, cy - py);
    const lout = Math.hypot(nx - cx, ny - cy);
    const r = Math.min(radius, lin / 2, lout / 2);
    const ax = cx - ((cx - px) / lin) * r;
    const ay = cy - ((cy - py) / lin) * r;
    const bx = cx + ((nx - cx) / lout) * r;
    const by = cy + ((ny - cy) / lout) * r;
    d += ` L${ax} ${ay} Q${cx} ${cy} ${bx} ${by}`;
  }
  const [lx, ly] = points.at(-1)!;
  return `${d} L${lx} ${ly}`;
}

/** Середина самого длинного отрезка — место для подписи условий. */
export function labelPoint(points: readonly Point[]): Point {
  let best: Point = points[0]!;
  let len = -1;
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1]!;
    const [bx, by] = points[i]!;
    const l = Math.hypot(bx - ax, by - ay);
    if (l > len) {
      len = l;
      best = [(ax + bx) / 2, (ay + by) / 2];
    }
  }
  return best;
}
