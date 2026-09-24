import { describe, expect, it } from 'vitest';
import { reactions, substances } from '../../data/demo/alumina-reactions';
import { HEIGHT, WIDTH, edges, labelPoint, nodes, roundedPath } from './layout';

describe('reaction graph layout', () => {
  it('places every substance inside the canvas without overlaps', () => {
    const placed = substances.map((s) => nodes[s.id]!);
    expect(placed.every(Boolean)).toBe(true);
    for (const n of placed) {
      expect(n.x).toBeGreaterThan(0);
      expect(n.x).toBeLessThan(WIDTH);
      expect(n.y).toBeGreaterThan(0);
      expect(n.y).toBeLessThan(HEIGHT);
    }
    for (const [i, a] of placed.entries()) for (const b of placed.slice(i + 1)) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(40);
  });

  it('draws one edge per reaction source, from source to target', () => {
    expect(edges).toHaveLength(reactions.reduce((n, r) => n + r.sources.length, 0));
    for (const e of edges) {
      const r = reactions.find((x) => x.id === e.reaction)!;
      expect(e.points[0]).toEqual([nodes[e.source]!.x, nodes[e.source]!.y]);
      expect(e.points.at(-1)).toEqual([nodes[r.target]!.x, nodes[r.target]!.y]);
    }
  });

  it('runs lines left to right, only horizontal, vertical or at 45°', () => {
    for (const e of edges) {
      for (let i = 1; i < e.points.length; i++) {
        const [ax, ay] = e.points[i - 1]!;
        const [bx, by] = e.points[i]!;
        const dx = bx - ax;
        const dy = Math.abs(by - ay);
        expect(dx, `${e.reaction}:${e.source}`).toBeGreaterThanOrEqual(0);
        expect(dx === 0 || dy === 0 || dx === dy, `${e.reaction}:${e.source} segment ${i}`).toBe(true);
      }
    }
  });

  it('builds rounded paths and label points', () => {
    expect(roundedPath([[0, 0], [100, 0]])).toBe('M0 0 L100 0');
    expect(roundedPath([[0, 0], [100, 0], [100, 100]], 10)).toBe('M0 0 L90 0 Q100 0 100 10 L100 100');
    expect(labelPoint([[0, 0], [10, 0], [10, 100]])).toEqual([10, 50]);
  });
});
