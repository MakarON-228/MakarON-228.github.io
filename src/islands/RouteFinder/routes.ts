// Поиск цепочек превращений (SPEC.md §7.8) — порт рекурсивного CTE `transformation_chains` из
// notebooks/pipeline.ipynb проекта sibur-ml и раскрытия цепочек в варианты по первому сырью.
import type { Reaction } from '../../data/demo/alumina-reactions';

/** Цепочка — id реакций по порядку. */
export type Chain = readonly number[];

/** Вариант — цепочка и конкретное сырьё первой реакции (у реакций 7 и 12 исходников несколько). */
export interface Variant {
  chain: Chain;
  source: number;
}

interface Row {
  target: number;
  pathMaterials: readonly number[];
  chain: Chain;
}

const overlaps = (a: readonly number[], b: readonly number[]) => a.some((x) => b.includes(x));

/**
 * Все цепочки от сырья со склада до `target`, как их отдаёт CTE:
 * - старт: реакции, среди исходников которых есть сырьё (`source_ids && ARRAY(… source_check = true)`);
 * - шаг: реакция, среди исходников которой есть продукт предыдущей (`tc.target_id = ANY(r.source_ids)`), и ни один её
 *   исходник ещё не встречался в пути (`NOT (r.source_ids && tc.path_materials)`) — защита от циклов;
 * - в ответ идут цепочки, чей последний продукт — цель.
 * Рекурсия CTE идёт поколениями, поэтому цепочки упорядочены по длине, внутри — по id реакций.
 */
export function findChains(reactions: readonly Reaction[], stock: ReadonlySet<number>, target: number): Chain[] {
  let rows: Row[] = reactions
    .filter((r) => r.sources.some((s) => stock.has(s)))
    .map((r) => ({ target: r.target, pathMaterials: r.sources, chain: [r.id] }));
  const found: Chain[] = [];
  while (rows.length) {
    for (const row of rows) if (row.target === target) found.push(row.chain);
    rows = rows.flatMap((tc) =>
      reactions
        .filter((r) => r.sources.includes(tc.target) && !overlaps(r.sources, tc.pathMaterials))
        .map((r) => ({ target: r.target, pathMaterials: [...tc.pathMaterials, ...r.sources], chain: [...tc.chain, r.id] })),
    );
  }
  return found;
}

/** Как в пайплайне: у первой реакции цепочки — отдельный вариант на каждый её исходник, в порядке `source_ids`. */
export function expandVariants(chains: readonly Chain[], reactions: readonly Reaction[]): Variant[] {
  const byId = new Map(reactions.map((r) => [r.id, r]));
  return chains.flatMap((chain) => byId.get(chain[0]!)!.sources.map((source) => ({ chain, source })));
}
