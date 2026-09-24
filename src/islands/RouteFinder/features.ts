// Условия реакции → признаки модели сложности (SPEC.md §7.8) — порт разбора из notebooks/pipeline.ipynb (sibur-ml):
// температура, затем доп. условия через «, »: с «MPa» — давление, с «microimpurit» — микропримеси, остальное — флаг
// с именем условия. Без зависимостей: модуль читает и скрипт npm run complexity.
import type { Reaction } from '../../data/demo/alumina-reactions';

/** Признаки в порядке обучения модели (models/complexity_model.cbm). */
export const FEATURES = [
  'temperature',
  'MPa',
  'hydrothermal process',
  'vacuum',
  'microimpurities',
  'equilibrium crystallization',
  'nonequilibrium crystallization',
] as const;

/**
 * Строки условий в CSV репозитория расходятся с теми, что ноутбук подавал в модель (в его выводе — MPa 80,
 * hydrothermal 1, microimpurities 1 у χ → κ). Три правки воспроизводят напечатанные входы: опечатка `hydrotermal`,
 * стабилизация микропримесями M⁺ и диапазон давления 70–90 MPa → середина.
 */
const ALIASES: Record<string, string> = {
  'hydrotermal process': 'hydrothermal process',
  'stab. by M+': 'microimpurities',
};

function megapascals(condition: string): number {
  const [lo = NaN, hi = lo] = condition.split(/\s+/)[0]!.replace('MPa', '').split('-').map(Number);
  return (lo + hi) / 2;
}

export function featuresOf(r: Reaction): number[] {
  const d: Record<string, number> = { temperature: r.temperature };
  for (const raw of String(r.conditions).split(', ')) {
    const condition = ALIASES[raw] ?? raw;
    if (condition.includes('MPa')) d['MPa'] = megapascals(condition);
    else if (condition.includes('microimpurit')) d['microimpurities'] = 1;
    else d[condition] = 1;
  }
  return FEATURES.map((f) => d[f] ?? 0);
}
