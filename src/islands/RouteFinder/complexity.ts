// Сложность цепочки (SPEC.md §7.8), как в notebooks/pipeline.ipynb (sibur-ml): каждую реакцию оценивает модель
// CatBoost проекта, сложность цепочки — сумма оценок, варианты — по возрастанию. Оценки посчитаны заранее
// (`npm run complexity`), потому что граф фиксирован, а модель слишком велика для острова.
import scores from '../../data/demo/alumina-complexity.json';

const byReaction = scores.reactions as Record<string, { x: number[]; score: number }>;

export function stepScore(reaction: number): number {
  const s = byReaction[reaction];
  if (!s) throw new Error(`no complexity score for reaction ${reaction}; run npm run complexity`);
  return s.score;
}

export const chainComplexity = (chain: readonly number[]) => chain.reduce((sum, id) => sum + stepScore(id), 0);

/** `sorted(…, key=complexity)`: устойчиво, равные остаются в порядке вариантов. */
export const byComplexity = <T extends { complexity: number }>(items: readonly T[]): T[] =>
  [...items].sort((a, b) => a.complexity - b.complexity);
