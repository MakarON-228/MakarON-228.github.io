// Демо TwoModels: синтетика детерминирована и показывает задумку, метрики и шкала графика считаются верно.
import { describe, expect, it } from 'vitest';
import { LAYOUTS, blendLabelFits, linePath, nearestIndex, niceScale, xAt, yAt } from './chart';
import { blend, decileGroups, decileMae, mse } from './metrics';
import { generate } from './synth';

const data = generate();
const groups = decileGroups(data.y);
const maeA = decileMae(data.y, data.a, groups);
const maeB = decileMae(data.y, data.b, groups);

describe('synthetic data', () => {
  it('is the same on every run', () => {
    const again = generate();
    expect(again.y.slice(0, 5)).toEqual(data.y.slice(0, 5));
    expect(again.b.at(-1)).toBe(data.b.at(-1));
  });

  it('has a heavy right tail', () => {
    const sorted = [...data.y].sort((p, q) => p - q);
    const mean = data.y.reduce((s, v) => s + v, 0) / data.y.length;
    expect(data.y.every((v) => v > 0)).toBe(true);
    expect(mean).toBeGreaterThan(sorted[1000]!);
    expect(sorted.at(-1)! / sorted[1000]!).toBeGreaterThan(4);
  });

  it('model A wins in the middle, model B at both edges', () => {
    for (const d of [3, 4, 5, 6]) expect(maeA[d]).toBeLessThan(maeB[d]!);
    for (const d of [0, 9]) expect(maeB[d]).toBeLessThan(maeA[d]!);
  });

  it('a 0.6 / 0.4 blend beats both models on MSE', () => {
    const m = mse(data.y, blend(data.a, data.b, 0.6));
    expect(m).toBeLessThan(0.7 * Math.min(mse(data.y, data.a), mse(data.y, data.b)));
  });

  it('the blend never errs more than the worse model in any decile', () => {
    for (const w of [0, 0.25, 0.5, 0.75, 1]) {
      const mae = decileMae(data.y, blend(data.a, data.b, w), groups);
      mae.forEach((v, d) => expect(v).toBeLessThanOrEqual(Math.max(maeA[d]!, maeB[d]!) + 1e-12));
    }
  });
});

describe('metrics', () => {
  it('blend is w · a + (1 − w) · b', () => {
    expect(blend([1, 2], [3, 6], 0.25)).toEqual([2.5, 5]);
  });

  it('mse', () => {
    expect(mse([1, 2, 3], [1, 4, 0])).toBeCloseTo((0 + 4 + 9) / 3);
  });

  it('decile groups split by the true value into ten equal parts', () => {
    expect(groups.map((g) => g.length)).toEqual(Array(10).fill(200));
    for (let d = 1; d < 10; d++) {
      expect(Math.max(...groups[d - 1]!.map((i) => data.y[i]!))).toBeLessThanOrEqual(Math.min(...groups[d]!.map((i) => data.y[i]!)));
    }
  });

  it('decile MAE averages absolute errors per group', () => {
    const y = [1, 2, 3, 4];
    expect(decileMae(y, [2, 2, 3, 1], decileGroups(y, 2))).toEqual([0.5, 1.5]);
  });
});

describe('chart geometry', () => {
  it('rounds the axis to at most five clean steps', () => {
    expect(niceScale(0.17)).toEqual({ max: 0.2, step: 0.05, ticks: [0, 0.05, 0.1, 0.15, 0.2] });
    expect(niceScale(0.042).max).toBe(0.05);
  });

  it('maps deciles and values into the plot area', () => {
    for (const l of LAYOUTS) {
      expect(xAt(l, 0)).toBe(l.left);
      expect(xAt(l, 9)).toBe(l.width - l.right);
      expect(yAt(l, 0, 0.2)).toBe(l.height - l.bottom);
      expect(yAt(l, 0.2, 0.2)).toBe(l.top);
      expect(nearestIndex(l, xAt(l, 4) + 3)).toBe(4);
      expect(nearestIndex(l, -50)).toBe(0);
      expect(linePath(l, maeA, 0.2).match(/[ML]/g)).toHaveLength(10);
    }
  });

  it('drops the blend end label only when it would touch a model label', () => {
    expect(blendLabelFits({ a: 30, b: 150, blend: 90 })).toBe(true);
    expect(blendLabelFits({ a: 30, b: 150, blend: 140 })).toBe(false);
  });
});
