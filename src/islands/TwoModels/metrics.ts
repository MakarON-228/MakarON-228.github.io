// Метрики демо TwoModels: смесь двух прогнозов с весом w, MSE и средняя абсолютная ошибка по децилям истинного значения.

export const blend = (a: readonly number[], b: readonly number[], w: number) => a.map((v, i) => w * v + (1 - w) * b[i]!);

export function mse(y: readonly number[], p: readonly number[]): number {
  let s = 0;
  for (let i = 0; i < y.length; i++) s += (p[i]! - y[i]!) ** 2;
  return s / y.length;
}

/** Индексы наблюдений по децилям истинного значения: сортировка по y и десять равных частей. */
export function decileGroups(y: readonly number[], k = 10): number[][] {
  const order = y.map((_, i) => i).sort((i, j) => y[i]! - y[j]!);
  return Array.from({ length: k }, (_, d) => order.slice(Math.round((d * y.length) / k), Math.round(((d + 1) * y.length) / k)));
}

export function decileMae(y: readonly number[], p: readonly number[], groups: readonly number[][]): number[] {
  return groups.map((g) => g.reduce((s, i) => s + Math.abs(p[i]! - y[i]!), 0) / g.length);
}
