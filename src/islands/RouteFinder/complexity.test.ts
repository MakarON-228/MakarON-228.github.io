import { describe, expect, it } from 'vitest';
import { CORUNDUM, reactions } from '../../data/demo/alumina-reactions';
import scores from '../../data/demo/alumina-complexity.json';
import { chainComplexity, stepScore } from './complexity';
import { FEATURES, featuresOf } from './features';
import { boundaryDeterminant, type Bounds } from './mix';
import { NOTEBOOK_SPEC, run, substanceById, targets } from './pipeline';

describe('complexity features', () => {
  it('match the stored model inputs for every reaction', () => {
    expect(scores.features).toEqual([...FEATURES]);
    for (const r of reactions) expect(featuresOf(r), `reaction ${r.id}`).toEqual((scores.reactions as Record<string, { x: number[] }>)[r.id]!.x);
  });

  it('reproduce what the notebook fed the model', () => {
    const byId = (id: number) => featuresOf(reactions.find((r) => r.id === id)!);
    expect(byId(18)).toEqual([450, 80, 1, 0, 0, 0, 0]); // 70-90MPa, hydrotermal process
    expect(byId(3)).toEqual([900, 0, 0, 0, 1, 0, 0]); // stab. by M+
    expect(byId(7)).toEqual([230, 0, 0, 1, 0, 0, 0]); // vacuum
    expect(byId(19)).toEqual([2300, 0, 0, 0, 0, 0, 1]);
    expect(byId(20)).toEqual([2100, 0, 0, 0, 1, 0, 0]); // +SiO_2 microimpurity
  });
});

describe('CatBoost scores', () => {
  it('equal the predictions printed in the notebook', () => {
    const printed: Record<number, number> = {
      1: 3.1475226662423825, // 1200 °C
      2: 0.9919627055224369, // 230 °C
      3: 3.022559252022014, // 900 °C, microimpurities
      5: 2.0402237022065486, // 850 °C
      7: 1.999999786732158, // 230 °C, vacuum
      11: 2.7495945141674643, // 750 °C
      12: 3.4886153528416837, // 300 °C, 80 MPa, hydrothermal
      15: 2.6851372026040647, // 450 °C
      16: 2.0521581988956514, // 600 °C
      17: 2.9943790556640018, // 1050 °C
      18: 5.377528163407997, // 450 °C, 80 MPa, hydrothermal
    };
    for (const [id, score] of Object.entries(printed)) expect(stepScore(Number(id))).toBe(score);
  });

  it('sums steps into chain complexity', () => {
    expect(chainComplexity([14])).toBe(stepScore(14));
    expect(chainComplexity([6, 5, 1])).toBeCloseTo(0.99196 + 2.04022 + 3.14752, 4);
  });
});

describe('pipeline', () => {
  const b = (boundaryDeterminant(NOTEBOOK_SPEC) as { bounds: Bounds }).bounds;

  it('ranks the 13 corundum variants from diaspore to the melt', () => {
    const { ranked, dropped } = run(CORUNDUM, 20, b);
    expect(dropped).toEqual([]);
    expect(ranked).toHaveLength(13);
    expect(ranked[0]).toMatchObject({ chain: [14], source: 15 });
    expect(ranked[0]!.complexity).toBeCloseTo(3.1475, 4);
    expect(ranked.at(-1)).toMatchObject({ chain: [19, 16, 17, 1], source: 19 });
    expect(ranked.at(-1)!.complexity).toBeCloseTo(18.194, 3);
    const c = ranked.map((r) => r.complexity);
    expect(c).toEqual([...c].sort((x, y) => x - y));
    // Равные сложности — в порядке вариантов: гиббсит, затем аморфный
    expect(ranked.filter((r) => r.chain.join() === '12,18').map((r) => r.source)).toEqual([3, 13]);
  });

  it('moves infeasible variants to dropped', () => {
    const lowFe = (boundaryDeterminant({ ...NOTEBOOK_SPEC, fe_percent: '<0.005' }) as { bounds: Bounds }).bounds;
    const { ranked, dropped } = run(CORUNDUM, 20, lowFe);
    expect(new Set(dropped.map((r) => r.source))).toEqual(new Set([14, 15, 19]));
    expect(ranked.length + dropped.length).toBe(13);
    expect(ranked[0]).toMatchObject({ chain: [6, 5, 1], source: 8 });
  });

  it('offers every substance reachable from stock as a target', () => {
    expect(targets.map((s) => s.id).sort((x, y) => x - y)).toEqual([1, 2, 4, 5, 9, 11, 12, 14, 16, 17, 20]);
    expect(substanceById.get(CORUNDUM)!.label).toBe('α-Al₂O₃');
  });
});
