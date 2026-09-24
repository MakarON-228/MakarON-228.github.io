// Подбор масс партий сырья (SPEC.md §7.8) — порт `al_coeff`, `gcd`, `boundary_determinant` и `mass_calculator`
// из notebooks/pipeline.ipynb проекта sibur-ml. ЛП решает свой симплекс вместо PuLP (см. lp.ts).
import type { Substance } from '../../data/demo/alumina-reactions';
import { COMPONENTS, type Batch, type Component } from '../../data/demo/alumina-warehouse';
import { minimize, type Constraint } from './lp';

/** Допуск доли компонента в продукте, 0…1. */
export interface Bound {
  min: number;
  max: number;
}
export type Bounds = Record<Component, Bound>;
export type Spec = Record<Component, string>;

/** `al_coeff`: атомов Al — цифра через три символа после «Al» (`Al_2O_3` → 2), иначе 1. */
export function alCoeff(s: string): number {
  const i = s.indexOf('Al') + 3;
  return i < s.length && /[0-9]/.test(s[i]!) ? Number(s[i]) : 1;
}

export function gcd(a: number, b: number): number {
  while (b) [a, b] = [b, a % b];
  return a;
}

/** Кг продукта на 1 кг сырья по сохранению Al: НОК атомов Al, молярные массы из БД. */
export function massRatio(source: Substance, target: Substance): number {
  const s = alCoeff(source.formula);
  const t = alCoeff(target.formula);
  const nok = (s * t) / gcd(s, t);
  return ((nok / t) * target.molarMass) / ((nok / s) * source.molarMass);
}

/**
 * Одно поле `boundary_determinant`: `>98` → [0.98, 1], `<0.015` → [0, 0.00015], `0.1-0.3` → [0.001, 0.003].
 * Проценты делятся на 100. Всё остальное пайплайн не понимал — здесь это `null` (в ноутбуке — исключение).
 */
export function parseBound(s: string): Bound | null {
  const pct = (v: string) => (v.trim() === '' ? NaN : Number(v) / 100);
  let bound: Bound;
  if (s[0] === '>') bound = { min: pct(s.slice(1)), max: 1 };
  else if (s[0] === '<') bound = { min: 0, max: pct(s.slice(1)) };
  else if (s.includes('-')) {
    const [lo = '', hi = ''] = s.split('-');
    bound = { min: pct(lo), max: pct(hi) };
  } else return null;
  return Number.isFinite(bound.min) && Number.isFinite(bound.max) ? bound : null;
}

/** `boundary_determinant` целиком: границы всех семи компонентов или список полей, которые не разобрались. */
export function boundaryDeterminant(spec: Spec): { bounds: Bounds } | { invalid: Component[] } {
  const parsed = COMPONENTS.map((c) => [c, parseBound(spec[c])] as const);
  const invalid = parsed.filter(([, b]) => !b).map(([c]) => c);
  if (invalid.length) return { invalid };
  return { bounds: Object.fromEntries(parsed) as Bounds };
}

export interface Mix {
  /** Кг каждой партии, в порядке склада; меньше 1e-6 — ноль, как «Почти ноль» в ноутбуке. */
  masses: { batch: Batch; kg: number }[];
  /** Доля компонентов в продукте — то, что ноутбук печатал под «Содержание элементов». */
  content: Record<Component, number>;
}

/** Вклад партии в долю компонента: основное вещество пересчитывается в продукт через ratio, примеси — нет. */
const coefficient = (batch: Batch, c: Component, ratio: number) => (batch[c] / 100) * (c === 'main_percent' ? ratio : 1);

/**
 * `mass_calculator` для одного варианта: сколько кг каждой партии первого сырья взять, чтобы получить `mass` кг цели
 * в допусках. Ограничения и цель — как в модели PuLP: баланс `ratio · Σx = M`, по каждому компоненту
 * `min ≤ Σ coef · x / M ≤ max`, минимизируется `Σx`. Нет решения — `null` («Не удаётся подобрать массы»).
 */
export function massCalculator(batches: readonly Batch[], ratio: number, mass: number, bounds: Bounds): Mix | null {
  const constraints: Constraint[] = [{ a: batches.map(() => ratio), op: '=', b: mass }];
  for (const c of COMPONENTS) {
    const a = batches.map((batch) => coefficient(batch, c, ratio) / mass);
    constraints.push({ a, op: '<=', b: bounds[c].max }, { a, op: '>=', b: bounds[c].min });
  }
  const result = minimize(
    batches.map(() => 1),
    constraints,
  );
  if (result.status !== 'optimal') return null;
  const masses = batches.map((batch, i) => {
    const kg = result.x[i]!;
    return { batch, kg: kg > 1e-6 ? kg : 0 };
  });
  return { masses, content: composition(masses, ratio, mass) };
}

/** Состав продукта из смеси партий. */
export function composition(masses: readonly { batch: Batch; kg: number }[], ratio: number, mass: number) {
  return Object.fromEntries(
    COMPONENTS.map((c) => [c, masses.reduce((s, { batch, kg }) => s + kg * coefficient(batch, c, ratio), 0) / mass]),
  ) as Record<Component, number>;
}

/** Смесь укладывается в баланс массы и все допуски (с запасом на арифметику). */
export function withinBounds(masses: readonly { batch: Batch; kg: number }[], ratio: number, mass: number, bounds: Bounds): boolean {
  const total = masses.reduce((s, { kg }) => s + kg * ratio, 0);
  if (Math.abs(total - mass) > 1e-6 * mass) return false;
  const content = composition(masses, ratio, mass);
  return COMPONENTS.every((c) => content[c] >= bounds[c].min - 1e-9 && content[c] <= bounds[c].max + 1e-9);
}
