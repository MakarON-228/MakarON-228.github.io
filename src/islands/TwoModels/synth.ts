// Синтетика для демо TwoModels (SPEC.md §7.6). Ни данных ТМХ, ни моделей команды: выдуманные «износы» колёс с тяжёлым
// правым хвостом и две выдуманные модели, сделанные так, чтобы показать задумку. Модель A точна на типичных колёсах, но
// прижимает крайние значения к среднему; модель B несмещённая, зато шумная везде. По децилям видно, что ни одна не держит
// весь диапазон, а их взвешенная сумма точнее каждой. Генератор детерминированный — сервер и браузер рисуют одно и то же.

/** mulberry32: маленький сидируемый ГПСЧ. */
function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Synthetic {
  /** «Истинная» интенсивность износа. */
  y: number[];
  a: number[];
  b: number[];
}

export const PARAMS = {
  n: 2000,
  seed: 7,
  /** Лог-нормальное распределение: медиана 0.3, σ логарифма 0.5 — хвост вправо. */
  median: 0.3,
  spread: 0.5,
  /** A = среднее + shrink · (y − среднее) + шум. */
  shrink: 0.6,
  noiseA: 0.025,
  /** B = y + шум + шум, пропорциональный y. */
  noiseB: 0.09,
  relNoiseB: 0.03,
} as const;

export function generate(p = PARAMS): Synthetic {
  const rand = mulberry32(p.seed);
  // Бокс — Мюллер
  const normal = () => {
    let u = 0;
    while (u === 0) u = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
  };
  const y = Array.from({ length: p.n }, () => Math.exp(Math.log(p.median) + p.spread * normal()));
  const mean = y.reduce((s, v) => s + v, 0) / y.length;
  const a = y.map((v) => mean + p.shrink * (v - mean) + p.noiseA * normal());
  const b = y.map((v) => Math.max(0, v + p.noiseB * normal() + p.relNoiseB * v * normal()));
  return { y, a, b };
}
