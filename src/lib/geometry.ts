// Плоская геометрия для подложки карты (SPEC.md §7.4): обрезка по рамке, упрощение, площадь.
// Работает в любых координатах — градусах или пикселях проекции.

export type Point = readonly [number, number];
export type Ring = Point[];

export interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Обрезка кольца полигона по прямоугольнику (Сазерленд — Ходжман). Для прямоугольника результат
 * всегда одно кольцо; части, соединённые вдоль края, дают нулевые по площади перемычки — заливке это не мешает.
 */
export function clipRing(ring: readonly Point[], box: Box): Ring {
  const edges: [(p: Point) => boolean, (a: Point, b: Point) => Point][] = [
    [(p) => p[0] >= box.minX, (a, b) => atX(a, b, box.minX)],
    [(p) => p[0] <= box.maxX, (a, b) => atX(a, b, box.maxX)],
    [(p) => p[1] >= box.minY, (a, b) => atY(a, b, box.minY)],
    [(p) => p[1] <= box.maxY, (a, b) => atY(a, b, box.maxY)],
  ];
  let out: Ring = [...ring];
  for (const [inside, cross] of edges) {
    const input = out;
    out = [];
    input.forEach((cur, i) => {
      const prev = input[(i + input.length - 1) % input.length]!;
      if (inside(cur)) {
        if (!inside(prev)) out.push(cross(prev, cur));
        out.push(cur);
      } else if (inside(prev)) {
        out.push(cross(prev, cur));
      }
    });
    if (out.length === 0) break;
  }
  return out;
}

function atX(a: Point, b: Point, x: number): Point {
  return [x, a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0])];
}

function atY(a: Point, b: Point, y: number): Point {
  return [a[0] + ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]), y];
}

/** Упрощение ломаной (Дуглас — Пекер): точки ближе `tolerance` к отрезку выкидываются. Концы остаются. */
export function simplify(points: readonly Point[], tolerance: number): Ring {
  if (points.length < 3) return [...points];
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  const tol2 = tolerance * tolerance;
  while (stack.length > 0) {
    const [first, last] = stack.pop()!;
    let index = -1;
    let max = tol2;
    for (let i = first + 1; i < last; i++) {
      const d = segmentDistance2(points[i]!, points[first]!, points[last]!);
      if (d > max) {
        max = d;
        index = i;
      }
    }
    if (index >= 0) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

function segmentDistance2(p: Point, a: Point, b: Point): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  const x = a[0] + t * dx - p[0];
  const y = a[1] + t * dy - p[1];
  return x * x + y * y;
}

/** Площадь кольца по формуле шнурков, без знака. */
export function ringArea(ring: readonly Point[]): number {
  let sum = 0;
  ring.forEach((p, i) => {
    const q = ring[(i + 1) % ring.length]!;
    sum += p[0] * q[1] - q[0] * p[1];
  });
  return Math.abs(sum) / 2;
}

/** Замкнутое кольцо без повторённой последней точки и без подряд идущих дублей после округления. */
export function tidyRing(ring: readonly Point[], digits: number): Ring {
  const f = 10 ** digits;
  const out: Ring = [];
  for (const [x, y] of ring) {
    const p: Point = [Math.round(x * f) / f, Math.round(y * f) / f];
    const last = out[out.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p);
  }
  const first = out[0];
  const last = out[out.length - 1];
  if (out.length > 1 && first && last && first[0] === last[0] && first[1] === last[1]) out.pop();
  return out;
}
