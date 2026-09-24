// Пайплайн RouteFinder целиком (SPEC.md §7.8), в порядке ноутбука sibur-ml: цепочки к цели → варианты по первому
// сырью → подбор масс по партиям склада (без решения — вариант отпадает) → сложность CatBoost → сортировка.
import { reactions, substances, type Substance } from '../../data/demo/alumina-reactions';
import { warehouse, type Batch } from '../../data/demo/alumina-warehouse';
import { byComplexity, chainComplexity } from './complexity';
import { massCalculator, massRatio, type Bounds, type Mix, type Spec } from './mix';
import { expandVariants, findChains, type Variant } from './routes';

export const substanceById = new Map(substances.map((s) => [s.id, s]));
export const reactionById = new Map(reactions.map((r) => [r.id, r]));
export const stock: ReadonlySet<number> = new Set(substances.filter((s) => s.sourceCheck).map((s) => s.id));

/** Требования и масса, которые вводились при запуске notebooks/pipeline.ipynb, — состояние демо по умолчанию. */
export const NOTEBOOK_SPEC: Spec = {
  main_percent: '>98',
  fe_percent: '<0.015',
  si_percent: '0.1-0.3',
  k_percent: '0.01-0.08',
  ca_percent: '0.03-0.11',
  mg_percent: '0.005-0.03',
  na_percent: '<0.03',
};
export const NOTEBOOK_MASS = 20;

/** Партии сырья в порядке склада — как `SELECT * FROM warehouse WHERE type_id = …`. */
export const batchesOf = (type: number): Batch[] => warehouse.filter((b) => b.type === type);

/** Цели, к которым есть хотя бы одна цепочка со склада. */
export const targets: readonly Substance[] = substances.filter((s) => findChains(reactions, stock, s.id).length > 0);

export interface Route extends Variant {
  complexity: number;
  ratio: number;
  mix: Mix | null;
}

export interface Outcome {
  /** Варианты со смесью, от простых к сложным. */
  ranked: Route[];
  /** Варианты, для которых ЛП не нашла смесь в допусках, в исходном порядке. */
  dropped: Route[];
}

export function run(target: number, mass: number, bounds: Bounds): Outcome {
  const goal = substanceById.get(target)!;
  // Варианты с одним сырьём дают одну и ту же ЛП — считаем её один раз.
  const mixes = new Map<number, { ratio: number; mix: Mix | null }>();
  const routes = expandVariants(findChains(reactions, stock, target), reactions).map((v): Route => {
    let m = mixes.get(v.source);
    if (!m) {
      const ratio = massRatio(substanceById.get(v.source)!, goal);
      m = { ratio, mix: massCalculator(batchesOf(v.source), ratio, mass, bounds) };
      mixes.set(v.source, m);
    }
    return { ...v, ...m, complexity: chainComplexity(v.chain) };
  });
  return { ranked: byComplexity(routes.filter((r) => r.mix)), dropped: routes.filter((r) => !r.mix) };
}
