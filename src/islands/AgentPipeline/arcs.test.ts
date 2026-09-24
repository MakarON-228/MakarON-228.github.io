import { describe, expect, it } from 'vitest';
import { ARC_H, ARC_W, UNIT, arcPath, arcWidth } from './arcs';

const numbers = (d: string) => d.match(/-?\d+(\.\d+)?/g)!.map(Number);

describe('context arcs', () => {
  it('start and end at the station centres on the chain side of the band', () => {
    const [x1, y1, , , , , x2, y2] = numbers(arcPath(1, 4, false));
    expect([x1, y1, x2, y2]).toEqual([1.5 * UNIT, ARC_H, 4.5 * UNIT, ARC_H]);
    const [vx1, vy1, , , , , vx2, vy2] = numbers(arcPath(0, 8, true));
    expect([vx1, vy1, vx2, vy2]).toEqual([ARC_W, 0.5 * UNIT, ARC_W, 8.5 * UNIT]);
  });

  it('rise with distance and stay inside the band', () => {
    const peak = (from: number, to: number) => ARC_H - 0.75 * (ARC_H - numbers(arcPath(from, to, false))[3]!);
    expect(peak(0, 1)).toBeGreaterThan(peak(0, 3));
    for (let d = 1; d <= 8; d++) expect(peak(0, d)).toBeGreaterThanOrEqual(4);
    const left = (from: number, to: number) => ARC_W - 0.75 * (ARC_W - numbers(arcPath(from, to, true))[2]!);
    for (let d = 1; d <= 8; d++) expect(left(0, d)).toBeGreaterThanOrEqual(4);
  });

  it('get thicker with the character limit', () => {
    expect(arcWidth(1800)).toBeCloseTo(2.2);
    expect(arcWidth(6000)).toBe(5);
  });
});
