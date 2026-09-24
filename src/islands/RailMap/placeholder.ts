// Статичная заглушка карты (SPEC.md §7.4), собирается при сборке: те же станции и та же суша, что покажет MapLibre,
// в той же проекции. Точки сведены к сетке `cell` пикселей — одна точка на клетку и дорогу, чтобы HTML остался лёгким.

import type { Point as XY, Ring } from '../../lib/geometry';
import { ringArea, simplify, tidyRing } from '../../lib/geometry';
import type { Point } from './model';
import type { Frame } from './projection';

export interface GroupPath {
  group: number;
  d: string;
}

/** По одному пути на группу: `M x y h0` на каждую занятую клетку (круглый конец линии рисует точку). */
export function stationPaths(points: readonly Point[], f: Frame, cell: number): GroupPath[] {
  const cells = new Map<number, Set<string>>();
  for (const p of points) {
    if (p.halt) continue;
    const [x, y] = f.project(p.lon, p.lat);
    const key = `${Math.round(x / cell) * cell} ${Math.round(y / cell) * cell}`;
    const set = cells.get(p.group) ?? new Set<string>();
    set.add(key);
    cells.set(p.group, set);
  }
  return [...cells]
    .sort((a, b) => a[0] - b[0])
    .map(([group, set]) => ({ group, d: [...set].map((xy) => `M${xy}h0`).join('') }));
}

type Polygon = readonly (readonly XY[])[];

export interface LandCollection {
  features: { properties: { kind: 'land' | 'lake' }; geometry: { coordinates: Polygon[] } }[];
}

/** Суша или озёра одним путём в целых пикселях; кольца упрощены до `tolerance`, меньше `minArea` кв. пикселей — выброшены. */
export function landPath(land: LandCollection, kind: 'land' | 'lake', f: Frame, tolerance: number, minArea: number): string {
  const rings = land.features
    .filter((ft) => ft.properties.kind === kind)
    .flatMap((ft) => ft.geometry.coordinates.flat());
  return rings
    .map((ring): Ring => tidyRing(simplify(ring.map(([lon, lat]) => f.project(lon, lat)), tolerance), 0))
    .filter((ring) => ring.length >= 3 && ringArea(ring) >= minArea)
    .map((ring) => `M${ring.map(([x, y]) => `${x} ${y}`).join('L')}Z`)
    .join('');
}
