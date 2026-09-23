// Геометрия карты линий (SPEC.md §7.1). Чистые функции: считаются при сборке, проверяются тестами.
// Время — по оси t (горизонталь в широком виде, вертикаль в узком), линии — по оси c.

import type { Line } from '../../data/resume';

export type Orientation = 'horizontal' | 'vertical';

export interface Pt {
  x: number;
  y: number;
}

export interface StationInput {
  id: string;
  line: Line;
  name: string;
  date: string;
}

export interface Label {
  x: number;
  y: number;
  anchor: 'start' | 'middle';
  text: string;
}

export interface MapStation extends StationInput {
  month: number;
  x: number;
  y: number;
  label: Label;
  /** Выноска от станции к подписи (только вертикальный вид). */
  leader?: Pt[];
}

export interface MapLine {
  line: Line;
  points: Pt[];
  d: string;
}

export interface MapLayout {
  orientation: Orientation;
  width: number;
  height: number;
  lines: MapLine[];
  stations: MapStation[];
  hub: { x: number; y: number; width: number; height: number; label: Label };
  ticks: { year: number; from: Pt; to: Pt; label: Pt }[];
}

/** Порядок линий поперёк оси времени. */
export const LINE_ORDER: readonly Line[] = ['rail', 'science', 'agents', 'craft'];

export const START_YEAR = 2024;
export const YEARS = [2024, 2025, 2026] as const;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 'Jul 2025' → номер месяца от января 2024 (18). */
export function parseMonth(date: string): number {
  const match = /^([A-Z][a-z]{2}) (\d{4})$/.exec(date.trim());
  const month = match ? MONTHS.indexOf(match[1] ?? '') : -1;
  if (!match || month < 0) throw new Error(`Unrecognised date: ${date}`);
  return (Number(match[2]) - START_YEAR) * 12 + month;
}

/** Параметры видов. Размер шрифта подписей — в единицах viewBox. */
export const FONT = 15;

interface Params {
  width: number;
  height: number;
  /** Координата начала января 2024 по оси времени. */
  t0: number;
  /** Шаг одного месяца. */
  step: number;
  /** Дорожки линий по оси c, в порядке LINE_ORDER. */
  lanes: readonly number[];
  /** Линии внутри узла идут пучком с этим шагом. */
  bundle: number;
  /** Центр узла по оси времени. */
  hubT: number;
  /** Толщина капсулы по оси времени. */
  hubDepth: number;
}

const PARAMS: Record<Orientation, Params> = {
  horizontal: { width: 560, height: 258, t0: 24, step: 15, lanes: [58, 114, 170, 226], bundle: 12, hubT: 46, hubDepth: 28 },
  vertical: { width: 328, height: 430, t0: 34, step: 12, lanes: [52, 78, 104, 130], bundle: 12, hubT: 52, hubDepth: 24 },
};

/** Зазор между подписями в вертикальном виде и колонка подписей. */
const V_LABEL_GAP = 20;
const V_LABEL_C = 150;

const RADIUS = 10;

/** Позиция станции по оси времени — середина её месяца. */
export function timeCoord(month: number, orientation: Orientation): number {
  const p = PARAMS[orientation];
  return p.t0 + (month + 0.5) * p.step;
}

function bundleCoords(p: Params): number[] {
  const mid = (p.lanes[0]! + p.lanes[p.lanes.length - 1]!) / 2;
  return p.lanes.map((_, i) => mid + (i - (p.lanes.length - 1) / 2) * p.bundle);
}

/** Точка (t, c) → (x, y) для вида. */
function toPt(t: number, c: number, orientation: Orientation): Pt {
  return orientation === 'horizontal' ? { x: t, y: c } : { x: c, y: t };
}

/** Ломаная со скруглёнными углами: радиус не больше половины соседних отрезков. */
export function roundedPath(points: readonly Pt[], radius = RADIUS): string {
  const f = (n: number) => Math.round(n * 100) / 100;
  const first = points[0];
  if (!first) return '';
  let d = `M${f(first.x)} ${f(first.y)}`;
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1]!;
    const cur = points[i]!;
    const next = points[i + 1]!;
    const lenIn = Math.hypot(cur.x - prev.x, cur.y - prev.y);
    const lenOut = Math.hypot(next.x - cur.x, next.y - cur.y);
    const r = Math.min(radius, lenIn / 2, lenOut / 2);
    const a = { x: cur.x - ((cur.x - prev.x) / lenIn) * r, y: cur.y - ((cur.y - prev.y) / lenIn) * r };
    const b = { x: cur.x + ((next.x - cur.x) / lenOut) * r, y: cur.y + ((next.y - cur.y) / lenOut) * r };
    d += ` L${f(a.x)} ${f(a.y)} Q${f(cur.x)} ${f(cur.y)} ${f(b.x)} ${f(b.y)}`;
  }
  const last = points[points.length - 1]!;
  if (points.length > 1) d += ` L${f(last.x)} ${f(last.y)}`;
  return d;
}

/** Грубая оценка ширины подписи (Barlow Condensed 700, заглавные) — для проверки наложений. */
export function labelWidth(text: string, size = FONT): number {
  return text.length * size * 0.52;
}

export function buildMap(input: readonly StationInput[], orientation: Orientation, hubName: string): MapLayout {
  const p = PARAMS[orientation];
  const bundle = bundleCoords(p);
  const fanOut = p.t0 + 12 * p.step; // линии расходятся в начале 2025

  const stations: MapStation[] = input
    .map((s) => {
      const month = parseMonth(s.date);
      const c = p.lanes[LINE_ORDER.indexOf(s.line)]!;
      const t = timeCoord(month, orientation);
      return { ...s, month, ...toPt(t, c, orientation), label: { x: 0, y: 0, anchor: 'middle' as const, text: s.name } };
    })
    .sort((a, b) => a.month - b.month);

  const lines: MapLine[] = LINE_ORDER.flatMap((line, i) => {
    const own = stations.filter((s) => s.line === line);
    const last = own[own.length - 1];
    if (!last) return [];
    const from = bundle[i]!;
    const to = p.lanes[i]!;
    const endT = timeCoord(last.month, orientation);
    // пучок → диагональ 45° → дорожка до конечной
    const pts = [
      toPt(p.hubT, from, orientation),
      toPt(fanOut, from, orientation),
      toPt(fanOut + Math.abs(to - from), to, orientation),
      toPt(endT, to, orientation),
    ];
    return [{ line, points: pts, d: roundedPath(pts) }];
  });

  if (orientation === 'horizontal') {
    // Подписи над дорожкой; вторая станция той же линии — под ней, чтобы соседние имена не наезжали.
    for (const line of LINE_ORDER) {
      stations
        .filter((s) => s.line === line)
        .forEach((s, k) => {
          s.label = { x: s.x, y: k % 2 === 0 ? s.y - 13 : s.y + 25, anchor: 'middle', text: s.name };
        });
    }
  } else {
    // Подписи — колонкой справа от линий, по времени, с минимальным зазором; к станции ведёт выноска.
    let prev = -Infinity;
    for (const s of stations) {
      const at = Math.max(s.y, prev + V_LABEL_GAP);
      prev = at;
      s.label = { x: V_LABEL_C, y: at + FONT * 0.35, anchor: 'start', text: s.name };
      s.leader = [
        { x: s.x + 8, y: s.y },
        { x: V_LABEL_C - 12, y: s.y },
        { x: V_LABEL_C - 4, y: at },
      ];
    }
  }

  const hubSpan = bundle[bundle.length - 1]! - bundle[0]! + 2 * p.bundle + 4;
  const hubMid = (bundle[0]! + bundle[bundle.length - 1]!) / 2;
  const hubCenter = toPt(p.hubT, hubMid, orientation);
  const hubSize = toPt(p.hubDepth, hubSpan, orientation);
  const hubLabel: Label =
    orientation === 'horizontal'
      ? { x: hubCenter.x - p.hubDepth / 2, y: hubMid + hubSpan / 2 + 22, anchor: 'start', text: hubName }
      : { x: hubMid + hubSpan / 2 + 8, y: p.hubT + FONT * 0.35, anchor: 'start', text: hubName };

  const ticks = YEARS.map((year) => {
    const t = p.t0 + (year - START_YEAR) * 12 * p.step;
    return orientation === 'horizontal'
      ? { year, from: { x: t, y: 22 }, to: { x: t, y: p.height - 4 }, label: { x: t + 4, y: 14 } }
      : { year, from: { x: 0, y: t }, to: { x: p.width, y: t }, label: { x: 0, y: t + 14 } };
  });

  return {
    orientation,
    width: p.width,
    height: p.height,
    lines,
    stations,
    hub: { x: hubCenter.x - hubSize.x / 2, y: hubCenter.y - hubSize.y / 2, width: hubSize.x, height: hubSize.y, label: hubLabel },
    ticks,
  };
}

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Прямоугольник подписи по базовой линии (заглавные: высота ≈ кегль). */
export function labelBox(label: Label, size = FONT): Box {
  const w = labelWidth(label.text, size);
  const x0 = label.anchor === 'middle' ? label.x - w / 2 : label.x;
  return { x0, y0: label.y - size * 0.8, x1: x0 + w, y1: label.y + size * 0.2 };
}

export function overlaps(a: Box, b: Box): boolean {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
}
