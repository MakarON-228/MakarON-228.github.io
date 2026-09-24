// Геометрия графика MAE по децилям. SVG масштабируется по ширине блока, поэтому раскладок три — по ширине блока до 400,
// до 640 и шире: у каждой свой viewBox, и подписи остаются в 0.9–1.4 раза от задуманного (переключает CSS, без JS).
// Шкала Y одна для всех весов: ошибка смеси в каждом дециле не больше худшей из двух моделей, так что линии не прыгают
// при движении ползунка.

export interface Layout {
  id: 'xs' | 'sm' | 'lg';
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export const LAYOUTS: readonly Layout[] = [
  { id: 'xs', width: 290, height: 230, left: 34, right: 58, top: 12, bottom: 40 },
  { id: 'sm', width: 460, height: 250, left: 40, right: 64, top: 12, bottom: 40 },
  { id: 'lg', width: 700, height: 270, left: 44, right: 72, top: 12, bottom: 40 },
];

const STEPS = [0.01, 0.02, 0.025, 0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5];

/** Круглый верх шкалы: самый мелкий шаг, при котором хватает пяти делений. */
export function niceScale(max: number): { max: number; step: number; ticks: number[] } {
  const step = STEPS.find((s) => Math.ceil(max / s) <= 5) ?? STEPS.at(-1)!;
  const top = Math.ceil(max / step) * step;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => Number((i * step).toFixed(6)));
  return { max: top, step, ticks };
}

export const xAt = (l: Layout, i: number, n = 10) => l.left + (i * (l.width - l.left - l.right)) / (n - 1);
export const yAt = (l: Layout, v: number, max: number) => l.top + (l.height - l.top - l.bottom) * (1 - v / max);

export const linePath = (l: Layout, values: readonly number[], max: number) =>
  values.map((v, i) => `${i ? 'L' : 'M'} ${xAt(l, i, values.length).toFixed(1)} ${yAt(l, v, max).toFixed(1)}`).join(' ');

/** Ближайший дециль к точке x в единицах viewBox. */
export function nearestIndex(l: Layout, x: number, n = 10): number {
  const step = (l.width - l.left - l.right) / (n - 1);
  return Math.min(n - 1, Math.max(0, Math.round((x - l.left) / step)));
}

/**
 * Подписи у правых концов линий. Подписи моделей стоят всегда; подпись смеси — только если не налезает на них
 * (ближе minGap по вертикали): сдвигать подписи от своих линий хуже, чем оставить смесь легенде и подсказке.
 */
export function blendLabelFits(ends: { a: number; b: number; blend: number }, minGap = 14): boolean {
  return Math.abs(ends.blend - ends.a) >= minGap && Math.abs(ends.blend - ends.b) >= minGap;
}
