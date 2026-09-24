import { describe, expect, it } from 'vitest';
import { CORUNDUM, substances } from '../../data/demo/alumina-reactions';
import { COMPONENTS, warehouse } from '../../data/demo/alumina-warehouse';
import { alCoeff, boundaryDeterminant, gcd, massCalculator, massRatio, parseBound, withinBounds, type Bounds, type Spec } from './mix';
import { NOTEBOOK_MASS, NOTEBOOK_SPEC, batchesOf, stock, substanceById } from './pipeline';

const MASS = NOTEBOOK_MASS;

const bounds = (spec: Spec): Bounds => {
  const r = boundaryDeterminant(spec);
  if (!('bounds' in r)) throw new Error(`invalid: ${r.invalid.join()}`);
  return r.bounds;
};
const corundum = substanceById.get(CORUNDUM)!;
const ratioOf = (id: number) => massRatio(substanceById.get(id)!, corundum);

describe('stoichiometry (al_coeff)', () => {
  it('counts Al in the DB formulas', () => {
    const count = Object.fromEntries(substances.map((s) => [s.id, alCoeff(s.formula)]));
    expect(count).toMatchObject({ 1: 2, 2: 2, 3: 1, 8: 1, 10: 1, 12: 2, 13: 1, 14: 1, 15: 1, 19: 2, 20: 2 });
    expect(gcd(2, 1)).toBe(1);
    expect(gcd(12, 18)).toBe(6);
  });

  it('gives kg of corundum per kg of raw material', () => {
    expect(ratioOf(3)).toBeCloseTo(102 / 156, 12); // Al(OH)₃ → 0.653846, 1.5294 кг на 1 кг
    expect(ratioOf(15)).toBeCloseTo(0.85, 12); // AlO(OH), как в выводе ноутбука
    expect(ratioOf(19)).toBe(1);
    expect(1 / ratioOf(8)).toBeCloseTo(1.5294, 4);
    expect(1 / ratioOf(14)).toBeCloseTo(1.1765, 4);
  });
});

describe('boundary_determinant', () => {
  it('parses the three forms into fractions', () => {
    expect(parseBound('>98')).toEqual({ min: 0.98, max: 1 });
    expect(parseBound('<0.015')).toEqual({ min: 0, max: 0.00015 });
    expect(parseBound('0.1-0.3')).toEqual({ min: 0.001, max: 0.003 });
  });

  it('rejects what the notebook could not read', () => {
    for (const s of ['', '98', '>', '<abc', '-5', '0.1-', ' >98']) expect(parseBound(s)).toBeNull();
    expect(boundaryDeterminant({ ...NOTEBOOK_SPEC, fe_percent: 'low', na_percent: '' })).toEqual({ invalid: ['fe_percent', 'na_percent'] });
  });
});

describe('mass_calculator', () => {
  it('finds a mix in the notebook spec for every raw material', () => {
    const b = bounds(NOTEBOOK_SPEC);
    for (const id of stock) {
      const mix = massCalculator(batchesOf(id), ratioOf(id), MASS, b);
      expect(mix, substanceById.get(id)!.label).not.toBeNull();
      expect(withinBounds(mix!.masses, ratioOf(id), MASS, b)).toBe(true);
      expect(mix!.masses.map((m) => m.batch.type).every((t) => t === id)).toBe(true);
      for (const c of COMPONENTS) expect(mix!.content[c]).toBeGreaterThanOrEqual(b[c].min - 1e-9);
    }
  });

  it('accepts the mixes CBC found in the notebook', () => {
    // «Масса каждого компонента (кг)» из вывода ноутбука для 20 кг корунда
    const cbc: Record<number, Record<number, number>> = {
      15: { 22: 13.611111, 24: 7.140523, 47: 2.777778 },
      14: { 19: 7.848724, 40: 11.976985, 46: 3.703704 },
      3: { 5: 7.622742, 3: 3.73438, 1: 19.231114 },
      13: { 11: 11.535948, 14: 14.150327, 45: 4.901961 },
    };
    const b = bounds(NOTEBOOK_SPEC);
    for (const [id, kg] of Object.entries(cbc)) {
      const masses = batchesOf(Number(id)).map((batch) => ({ batch, kg: kg[batch.id] ?? 0 }));
      expect(withinBounds(masses, ratioOf(Number(id)), MASS, b), id).toBe(true);
    }
  });

  it('drops boehmite, diaspore and Al₂O₃ when iron must stay under 0.005 %', () => {
    const b = bounds({ ...NOTEBOOK_SPEC, fe_percent: '<0.005' });
    const infeasible = [...stock].filter((id) => !massCalculator(batchesOf(id), ratioOf(id), MASS, b));
    expect(infeasible.sort((x, y) => x - y)).toEqual([14, 15, 19]);
  });

  it('scales linearly with the target mass', () => {
    const b = bounds(NOTEBOOK_SPEC);
    const total = (m: number) => massCalculator(batchesOf(3), ratioOf(3), m, b)!.masses.reduce((s, x) => s + x.kg, 0);
    expect(total(20)).toBeCloseTo(20 / ratioOf(3), 6);
    expect(total(500)).toBeCloseTo(500 / ratioOf(3), 6);
  });

  it('has no mix without batches', () => {
    expect(massCalculator([], 1, MASS, bounds(NOTEBOOK_SPEC))).toBeNull();
    expect(warehouse).toHaveLength(49);
  });
});
