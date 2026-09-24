import { describe, expect, it } from 'vitest';
import type { Point } from './model';
import { stationPaths, landPath, type LandCollection } from './placeholder';
import { VIEW, frame, mercatorY } from './projection';

describe('placeholder projection', () => {
  it('uses Web Mercator like MapLibre', () => {
    expect(mercatorY(0)).toBeCloseTo(0, 12);
    expect(mercatorY(60)).toBeCloseTo(1.317, 3);
  });

  it('fits the view corners onto the frame corners', () => {
    const f = frame(VIEW, 720);
    const [x0, y0] = f.project(VIEW.west, VIEW.north);
    const [x1, y1] = f.project(VIEW.east, VIEW.south);
    expect([x0, y0]).toEqual([0, 0]);
    expect(x1).toBeCloseTo(720, 9);
    expect(y1).toBeCloseTo(f.height, 9);
    expect(f.height).toBeGreaterThan(300);
    expect(f.height).toBeLessThan(400);
  });

  it('draws one dot per occupied cell and railway, without halts', () => {
    const f = frame({ west: 0, south: 0, east: 10, north: 10 }, 100);
    const pt = (lon: number, lat: number, group: number, halt = false): Point => ({ name: '', lon, lat, group, esr: null, halt });
    const paths = stationPaths([pt(1, 1, 0), pt(1.01, 1.01, 0), pt(1, 1, 1), pt(5, 5, 0, true)], f, 4);
    expect(paths.map((p) => p.group)).toEqual([0, 1]);
    expect(paths[0]!.d.match(/M/g)).toHaveLength(1);
    expect(paths[0]!.d).toMatch(/^M\d+ \d+h0$/);
  });

  it('draws land in whole pixels and drops specks', () => {
    const f = frame({ west: 0, south: 0, east: 10, north: 10 }, 100);
    const land: LandCollection = {
      features: [
        { properties: { kind: 'land' }, geometry: { coordinates: [[[[1, 1], [9, 1], [9, 9], [1, 9], [1, 1]]], [[[5, 5], [5.05, 5], [5.05, 5.05], [5, 5]]]] } },
        { properties: { kind: 'lake' }, geometry: { coordinates: [] } },
      ],
    };
    const d = landPath(land, 'land', f, 1, 10);
    expect(d.match(/M/g)).toHaveLength(1);
    expect(d).toMatch(/^M\d+ \d+(L\d+ \d+)+Z$/);
    expect(landPath(land, 'lake', f, 1, 10)).toBe('');
  });
});
