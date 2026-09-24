import { describe, expect, it } from 'vitest';
import { CORUNDUM, reactions, type Reaction } from '../../data/demo/alumina-reactions';
import { stock } from './pipeline';
import { expandVariants, findChains } from './routes';

// Вывод ячейки поиска в notebooks/pipeline.ipynb (sibur-ml): в БД того запуска ещё не было реакций 19 и 20.
const NOTEBOOK_CHAINS = [[14], [18], [12, 18], [2, 3, 4], [6, 5, 1], [7, 10, 11, 1], [15, 16, 17, 1], [12, 15, 16, 17, 1]];

describe('route search (recursive CTE)', () => {
  it('reproduces the notebook run on the reactions it had', () => {
    const graph = reactions.filter((r) => r.id !== 19 && r.id !== 20);
    const chains = findChains(graph, stock, CORUNDUM);
    expect(chains).toEqual(NOTEBOOK_CHAINS);
    expect(expandVariants(chains, graph)).toHaveLength(12);
  });

  it('finds 9 chains and 13 variants to corundum on the full DB graph', () => {
    const chains = findChains(reactions, stock, CORUNDUM);
    expect(chains).toHaveLength(9);
    expect(chains).toContainEqual([19, 16, 17, 1]);
    const variants = expandVariants(chains, reactions);
    expect(variants).toHaveLength(13);
    // Реакция 7 — три исходника, реакция 12 — два: по варианту на каждый, в порядке source_ids
    expect(variants.filter((v) => v.chain[0] === 7).map((v) => v.source)).toEqual([3, 8, 10]);
    expect(variants.filter((v) => v.chain.join() === '12,18').map((v) => v.source)).toEqual([3, 13]);
  });

  it('starts only from reactions with a raw material in stock', () => {
    expect(findChains(reactions, new Set([15]), CORUNDUM)).toEqual([[14]]);
    expect(findChains(reactions, new Set(), CORUNDUM)).toEqual([]);
  });

  it('keeps intermediate targets and chains that pass through them', () => {
    // К θ: байерит → η → θ, ρ → γ(η) → θ (три сырья у реакции 7), бёмит → γ → δ → θ и т. д.
    const chains = findChains(reactions, stock, 1);
    expect(chains.every((c) => reactions.find((r) => r.id === c.at(-1))!.target === 1)).toBe(true);
    expect(chains).toContainEqual([6, 5]);
    expect(chains).toContainEqual([19, 16, 17]);
  });

  it('never reuses a material within a chain', () => {
    const loop: Reaction[] = [
      { id: 1, sources: [1], target: 2, temperature: 0, conditions: null },
      { id: 2, sources: [2], target: 1, temperature: 0, conditions: null },
      { id: 3, sources: [2], target: 3, temperature: 0, conditions: null },
    ];
    expect(findChains(loop, new Set([1]), 3)).toEqual([[1, 3]]);
    expect(findChains(loop, new Set([1]), 1)).toEqual([[1, 2]]);
  });
});
