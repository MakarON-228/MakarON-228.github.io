// Движение поезда по линии (SPEC.md §7.1): челнок между узлом и конечной со стоянками на станциях.
// Координата s — расстояние вдоль пути линии. Чистые функции, без DOM.

export interface ShuttleOptions {
  /** Длина пути от узла (s = 0) до конечной. */
  length: number;
  /** Положения станций вдоль пути; последняя — конечная. */
  stops: readonly number[];
  /** Скорость, единиц viewBox в секунду. */
  speed: number;
  /** Стоянка на станции и у узла, секунды. */
  dwell: number;
}

type Leg = { from: number; to: number; start: number; duration: number };

export interface Schedule {
  period: number;
  legs: Leg[];
  /** Время начала стоянки на каждой станции при движении от узла — с него стартует поезд этой станции. */
  departures: Map<number, number>;
}

export interface TrainState {
  s: number;
  /** +1 от узла, −1 к узлу. */
  dir: 1 | -1;
  /** Доля от максимальной скорости, 0…1 — для длины шлейфа. */
  pace: number;
}

/** Плавный разгон и торможение между остановками. */
const ease = (u: number) => u * u * (3 - 2 * u);
const easeRate = (u: number) => (6 * u * (1 - u)) / 1.5;

export function schedule({ length, stops, speed, dwell }: ShuttleOptions): Schedule {
  const points = [0, ...stops.filter((s) => s > 0 && s < length), length];
  const path = [...points, ...points.slice(0, -1).reverse()];
  const legs: Leg[] = [];
  const departures = new Map<number, number>();
  let t = 0;
  path.forEach((at, i) => {
    if (i < points.length && !departures.has(at)) departures.set(at, t);
    legs.push({ from: at, to: at, start: t, duration: dwell });
    t += dwell;
    const next = path[i + 1];
    if (next === undefined || i === path.length - 1) return;
    const duration = Math.abs(next - at) / speed;
    legs.push({ from: at, to: next, start: t, duration });
    t += duration;
  });
  // Последняя стоянка у узла совпадает с первой в следующем круге.
  legs.pop();
  t -= dwell;
  return { period: t, legs, departures };
}

/** Где поезд через `time` секунд после старта со стоянки на станции `origin`. */
export function trainAt(plan: Schedule, origin: number, time: number): TrainState {
  const offset = plan.departures.get(origin) ?? 0;
  const t = (((offset + time) % plan.period) + plan.period) % plan.period;
  let leg = plan.legs[0]!;
  for (const l of plan.legs) {
    if (l.start <= t) leg = l;
    else break;
  }
  const dir: 1 | -1 = leg.to < leg.from ? -1 : 1;
  if (leg.from === leg.to || leg.duration === 0) {
    // На стоянке направление — куда поедет дальше.
    const next = plan.legs[(plan.legs.indexOf(leg) + 1) % plan.legs.length]!;
    return { s: leg.from, dir: next.to < next.from ? -1 : 1, pace: 0 };
  }
  const u = Math.min(1, Math.max(0, (t - leg.start) / leg.duration));
  return { s: leg.from + (leg.to - leg.from) * ease(u), dir, pace: easeRate(u) };
}
