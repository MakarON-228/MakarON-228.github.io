// Раскладка графа знаний (ответ GET /knowledge-graph) для демо ApiExplorer: силовая схема Фрухтермана — Рейнгольда
// с детерминированным стартом. Только +, −, ×, ÷ и √ — результат одинаков на сервере и в любом браузере, поэтому
// статичная версия до гидратации совпадает с живой.

export interface GraphData {
  interests: readonly { id: number; name: string; scientist_count: number }[];
  scientists: readonly { id: number; name: string; username: string; interests: readonly number[] }[];
}

export interface GraphNode {
  kind: 'interest' | 'author' | 'user';
  /** id из ответа: у интереса — свой, у автора — author_interests.id + 100000, у пользователя — users.id. */
  id: number;
  label: string;
  x: number;
  y: number;
}

export interface Layout {
  width: number;
  height: number;
  nodes: GraphNode[];
  /** Рёбра учёный → интерес, индексы в nodes. */
  edges: [number, number][];
}

/** mulberry32: целочисленный генератор, одинаковый во всех движках. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ITERATIONS = 400;

export function layoutGraph(data: GraphData, width: number, height: number, pad = 14): Layout {
  const nodes: GraphNode[] = [
    ...data.interests.map((i) => ({ kind: 'interest' as const, id: i.id, label: i.name, x: 0, y: 0 })),
    ...data.scientists.map((s) => ({ kind: s.id >= 100000 ? ('author' as const) : ('user' as const), id: s.id, label: s.name, x: 0, y: 0 })),
  ];
  const interestIndex = new Map(data.interests.map((i, k) => [i.id, k]));
  const edges: [number, number][] = [];
  data.scientists.forEach((s, k) => {
    for (const id of s.interests) {
      const j = interestIndex.get(id);
      if (j !== undefined) edges.push([data.interests.length + k, j]);
    }
  });

  const n = nodes.length;
  if (!n) return { width, height, nodes, edges };
  const rand = rng(n * 7919 + edges.length);
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    x[i] = pad + rand() * (width - 2 * pad);
    y[i] = pad + rand() * (height - 2 * pad);
  }
  // Интересы с подписями отталкиваются сильнее — так подписи реже налезают друг на друга
  const weight = nodes.map((nd) => (nd.kind === 'interest' ? 1.6 : 1));
  const k = 0.5 * Math.sqrt((width * height) / n);
  const cx = width / 2;
  const cy = height / 2;
  const dx = new Float64Array(n);
  const dy = new Float64Array(n);

  for (let it = 0; it < ITERATIONS; it++) {
    const temp = (width / 8) * (1 - it / ITERATIONS) + 0.5;
    dx.fill(0);
    dy.fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let ex = x[i]! - x[j]!;
        let ey = y[i]! - y[j]!;
        let d2 = ex * ex + ey * ey;
        if (d2 < 1e-6) {
          // Совпавшие точки разводим детерминированно, по номерам
          ex = ((i % 7) - 3) * 0.1 + 0.05;
          ey = ((j % 5) - 2) * 0.1 + 0.05;
          d2 = ex * ex + ey * ey;
        }
        const f = (k * k * weight[i]! * weight[j]!) / d2;
        dx[i] = dx[i]! + ex * f;
        dy[i] = dy[i]! + ey * f;
        dx[j] = dx[j]! - ex * f;
        dy[j] = dy[j]! - ey * f;
      }
    }
    for (const [a, b] of edges) {
      const ex = x[a]! - x[b]!;
      const ey = y[a]! - y[b]!;
      const d = Math.sqrt(ex * ex + ey * ey);
      const f = d / k;
      dx[a] = dx[a]! - ex * f;
      dy[a] = dy[a]! - ey * f;
      dx[b] = dx[b]! + ex * f;
      dy[b] = dy[b]! + ey * f;
    }
    for (let i = 0; i < n; i++) {
      // Слабое притяжение к центру держит несвязанные узлы в кадре
      const gx = dx[i]! - (x[i]! - cx) * 0.04 * k;
      const gy = dy[i]! - (y[i]! - cy) * 0.04 * k;
      const len = Math.sqrt(gx * gx + gy * gy);
      if (len > 0) {
        const step = Math.min(len, temp) / len;
        x[i] = Math.min(width - pad, Math.max(pad, x[i]! + gx * step));
        y[i] = Math.min(height - pad, Math.max(pad, y[i]! + gy * step));
      }
    }
  }
  // Растянуть по рамке: схема сжимается к центру, а место под подписи есть по краям
  const fit = (v: Float64Array, lo: number, hi: number) => {
    let min = Infinity;
    let max = -Infinity;
    for (const t of v) {
      min = Math.min(min, t);
      max = Math.max(max, t);
    }
    const s = max > min ? (hi - lo) / (max - min) : 0;
    for (let i = 0; i < v.length; i++) v[i] = max > min ? lo + (v[i]! - min) * s : (lo + hi) / 2;
  };
  fit(x, pad, width - pad);
  fit(y, pad + 4, height - pad - 4);

  // Развести по вертикали то, что налезает: интерес вместе с подписью — прямоугольник, учёный — квадрат 8 × 8
  const boxes = nodes.map((nd, i) => {
    if (nd.kind !== 'interest') return { l: -4, r: 4, h: 4 };
    const w = labelWidth(nd.label) + LABEL_GAP;
    return labelOnRight(x[i]!, width) ? { l: -5, r: w, h: 7 } : { l: -w, r: 5, h: 7 };
  });
  for (let it = 0; it < 80; it++) {
    let moved = false;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = boxes[i]!;
        const b = boxes[j]!;
        const ox = Math.min(x[i]! + a.r, x[j]! + b.r) - Math.max(x[i]! + a.l, x[j]! + b.l);
        const oy = a.h + b.h - Math.abs(y[i]! - y[j]!);
        if (ox <= 0 || oy <= 0) continue;
        moved = true;
        const shift = oy / 2 + 0.5;
        const up = y[i]! < y[j]! || (y[i] === y[j] && i < j);
        y[i] = Math.min(height - pad, Math.max(pad, y[i]! + (up ? -shift : shift)));
        y[j] = Math.min(height - pad, Math.max(pad, y[j]! + (up ? shift : -shift)));
      }
    }
    if (!moved) break;
  }

  nodes.forEach((nd, i) => {
    nd.x = Math.round(x[i]! * 10) / 10;
    nd.y = Math.round(y[i]! * 10) / 10;
  });
  return { width, height, nodes, edges };
}

/** Размер подписи интереса в единицах viewBox (кегль 10, средняя ширина знака Overpass ≈ 0.55 em). */
export const LABEL_SIZE = 10;
export const LABEL_GAP = 8;
export const labelWidth = (s: string) => s.length * LABEL_SIZE * 0.55;
/** Подпись справа от узла, если справа хватает места. */
export const labelOnRight = (x: number, width: number) => x + LABEL_GAP + 0 < width * 0.62;
