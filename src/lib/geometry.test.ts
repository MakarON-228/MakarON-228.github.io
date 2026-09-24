import { describe, expect, it } from 'vitest';
import { clipRing, ringArea, simplify, tidyRing } from './geometry';

const box = { minX: 0, minY: 0, maxX: 10, maxY: 10 };

describe('map geometry', () => {
  it('keeps a ring that lies inside the box', () => {
    const ring = [[1, 1], [9, 1], [9, 9], [1, 9]] as const;
    expect(clipRing([...ring], box)).toEqual(ring);
  });

  it('cuts a ring that crosses the box edge along that edge', () => {
    const clipped = clipRing([[5, 2], [15, 2], [15, 8], [5, 8]], box);
    expect(clipped).toEqual([[5, 2], [10, 2], [10, 8], [5, 8]]);
    expect(ringArea(clipped)).toBe(30);
  });

  it('drops a ring outside the box', () => {
    expect(clipRing([[20, 20], [30, 20], [30, 30]], box)).toEqual([]);
  });

  it('simplifies a nearly straight line to its ends and keeps real corners', () => {
    expect(simplify([[0, 0], [1, 0.01], [2, -0.01], [3, 0]], 0.1)).toEqual([[0, 0], [3, 0]]);
    expect(simplify([[0, 0], [1, 1], [2, 0]], 0.1)).toEqual([[0, 0], [1, 1], [2, 0]]);
  });

  it('rounds a ring, removes repeated points and the closing duplicate', () => {
    expect(tidyRing([[0.04, 0], [0.01, 0], [1, 0], [1, 1], [0, 0]], 1)).toEqual([[0, 0], [1, 0], [1, 1]]);
  });
});
