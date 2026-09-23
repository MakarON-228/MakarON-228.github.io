import { describe, expect, it } from 'vitest';
import { schedule, trainAt } from './trains';

const plan = schedule({ length: 300, stops: [120, 300], speed: 60, dwell: 1 });

describe('shuttle train', () => {
  it('stands at its station, then departs away from the hub', () => {
    expect(trainAt(plan, 120, 0)).toEqual({ s: 120, dir: 1, pace: 0 });
    expect(trainAt(plan, 120, 0.9).s).toBe(120);
    const moving = trainAt(plan, 120, 1.5);
    expect(moving.s).toBeGreaterThan(120);
    expect(moving.dir).toBe(1);
  });

  it('turns back at the terminus', () => {
    expect(trainAt(plan, 300, 0)).toEqual({ s: 300, dir: -1, pace: 0 });
    expect(trainAt(plan, 300, 1.5).dir).toBe(-1);
  });

  it('stops at every station both ways and at the hub', () => {
    // 0 →(2 s) 120 →(3 s) 300 →(3 s) 120 →(2 s) 0, стоянка 1 s на каждой из пяти остановок в круге минус повтор узла
    expect(plan.period).toBeCloseTo(2 + 3 + 3 + 2 + 4 * 1);
    const hubArrival = trainAt(plan, 0, plan.period - 0.001);
    expect(hubArrival.s).toBeCloseTo(0, 1);
  });

  it('stays on the line and moves smoothly', () => {
    let prev = trainAt(plan, 120, 0).s;
    for (let t = 0; t < plan.period * 2; t += 0.05) {
      const { s, pace } = trainAt(plan, 120, t);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(300);
      expect(pace).toBeGreaterThanOrEqual(0);
      expect(pace).toBeLessThanOrEqual(1);
      expect(Math.abs(s - prev)).toBeLessThan(6);
      prev = s;
    }
  });
});
