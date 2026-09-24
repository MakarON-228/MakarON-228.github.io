import { describe, expect, it } from 'vitest';
import { minimize } from './lp';

const optimal = (r: ReturnType<typeof minimize>) => {
  if (r.status !== 'optimal') throw new Error(r.status);
  return r;
};

describe('two-phase simplex', () => {
  it('solves a textbook maximisation', () => {
    const r = optimal(
      minimize(
        [-1, -1],
        [
          { a: [1, 2], op: '<=', b: 4 },
          { a: [3, 1], op: '<=', b: 6 },
        ],
      ),
    );
    expect(r.x[0]).toBeCloseTo(1.6, 9);
    expect(r.x[1]).toBeCloseTo(1.2, 9);
    expect(r.value).toBeCloseTo(-2.8, 9);
  });

  it('handles equalities, ≥ rows and negative right-hand sides', () => {
    const r = optimal(
      minimize(
        [1, 2],
        [
          { a: [1, 1], op: '=', b: 5 },
          { a: [-1, 0], op: '<=', b: -1 }, // x ≥ 1
          { a: [1, 0], op: '<=', b: 3 },
        ],
      ),
    );
    expect(r.x[0]).toBeCloseTo(3, 9);
    expect(r.x[1]).toBeCloseTo(2, 9);
  });

  it('reports infeasible and unbounded problems', () => {
    expect(
      minimize(
        [1, 1],
        [
          { a: [1, 1], op: '<=', b: 1 },
          { a: [1, 1], op: '>=', b: 2 },
        ],
      ).status,
    ).toBe('infeasible');
    expect(minimize([-1, 0], [{ a: [1, -1], op: '<=', b: 1 }]).status).toBe('unbounded');
    expect(minimize([], [{ a: [], op: '=', b: 20 }]).status).toBe('infeasible');
  });

  it('drops redundant equalities', () => {
    const r = optimal(
      minimize(
        [1, 0],
        [
          { a: [1, 1], op: '=', b: 2 },
          { a: [2, 2], op: '=', b: 4 },
        ],
      ),
    );
    expect(r.x).toEqual([0, 2]);
  });

  it('does not cycle on Beale’s degenerate example', () => {
    const r = optimal(
      minimize(
        [-0.75, 150, -0.02, 6],
        [
          { a: [0.25, -60, -0.04, 9], op: '<=', b: 0 },
          { a: [0.5, -90, -0.02, 3], op: '<=', b: 0 },
          { a: [0, 0, 1, 0], op: '<=', b: 1 },
        ],
      ),
    );
    expect(r.value).toBeCloseTo(-0.05, 9);
  });
});
