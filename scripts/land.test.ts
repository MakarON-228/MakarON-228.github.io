// Проверки закоммиченной подложки `public/data/land.json` (scripts/build-land.ts).

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LAND_BOUNDS } from '../src/islands/RailMap/projection';

type Ring = [number, number][];
const land = JSON.parse(readFileSync(new URL('../public/data/land.json', import.meta.url), 'utf8')) as {
  features: { properties: { kind: string }; geometry: { type: string; coordinates: Ring[][] } }[];
};

describe('committed land layer', () => {
  it('has one land and one lake multipolygon', () => {
    expect(land.features.map((f) => [f.properties.kind, f.geometry.type])).toEqual([
      ['land', 'MultiPolygon'],
      ['lake', 'MultiPolygon'],
    ]);
  });

  it('has closed rings of coordinate pairs inside the map bounds', () => {
    const rings = land.features.flatMap((f) => f.geometry.coordinates.flat());
    expect(rings.length).toBeGreaterThan(100);
    for (const ring of rings) {
      expect(ring.length).toBeGreaterThanOrEqual(4);
      expect(ring[0]).toEqual(ring[ring.length - 1]);
      for (const [lon, lat] of ring) {
        expect(lon).toBeGreaterThanOrEqual(LAND_BOUNDS.west);
        expect(lon).toBeLessThanOrEqual(LAND_BOUNDS.east);
        expect(lat).toBeGreaterThanOrEqual(LAND_BOUNDS.south);
        expect(lat).toBeLessThanOrEqual(LAND_BOUNDS.north);
      }
    }
  });
});
