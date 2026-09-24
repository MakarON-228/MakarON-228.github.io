// Подложка карты RailMap (SPEC.md §7.4): суша и крупные озёра Natural Earth 1:50m (public domain),
// обрезанные по рамке России и упрощённые. Границ государств нет намеренно — страну показывает сама сеть.
// Запуск вручную: `npm run land`; результат `public/data/land.json` коммитится.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import type { Box, Point, Ring } from '../src/lib/geometry.ts';
import { clipRing, ringArea, simplify, tidyRing } from '../src/lib/geometry.ts';
import { LAND_BOUNDS } from '../src/islands/RailMap/projection.ts';

const SOURCE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson';
const CACHE = '.cache';
const OUT = 'public/data/land.json';
const LAND_BOX: Box = { minX: LAND_BOUNDS.west, minY: LAND_BOUNDS.south, maxX: LAND_BOUNDS.east, maxY: LAND_BOUNDS.north };
const TOLERANCE = 0.02; // градуса, ≈ 1–2 км
const MIN_AREA = 0.02; // кв. градуса: острова меньше ≈ 100 км² не рисуем
const DIGITS = 3;

type Polygon = Point[][];
interface Feature {
  geometry: { type: 'Polygon'; coordinates: Polygon } | { type: 'MultiPolygon'; coordinates: Polygon[] };
}

async function load(name: string): Promise<Feature[]> {
  const path = `${CACHE}/${name}.geojson`;
  if (!existsSync(path)) {
    const res = await fetch(`${SOURCE}/${name}.geojson`);
    if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
    mkdirSync(CACHE, { recursive: true });
    writeFileSync(path, await res.text());
  }
  return (JSON.parse(readFileSync(path, 'utf8')) as { features: Feature[] }).features;
}

function prepareRing(ring: readonly Point[]): Ring | null {
  const open = ring.slice(0, -1);
  const clipped = clipRing(open, LAND_BOX);
  if (clipped.length < 3) return null;
  const simple = tidyRing(simplify([...clipped, clipped[0]!], TOLERANCE), DIGITS);
  return simple.length >= 3 && ringArea(simple) >= MIN_AREA ? [...simple, simple[0]!] : null;
}

function preparePolygons(features: readonly Feature[]): Polygon[] {
  const polygons = features.flatMap((f) => (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates));
  const result: Polygon[] = [];
  for (const [outer, ...holes] of polygons) {
    const shell = outer && prepareRing(outer);
    if (!shell) continue;
    const inner = holes.map(prepareRing).filter((h): h is Ring => h !== null);
    result.push([shell, ...inner]);
  }
  return result;
}

const land = preparePolygons(await load('ne_50m_land'));
const lakes = preparePolygons(await load('ne_50m_lakes'));
const collection = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: { kind: 'land' }, geometry: { type: 'MultiPolygon', coordinates: land } },
    { type: 'Feature', properties: { kind: 'lake' }, geometry: { type: 'MultiPolygon', coordinates: lakes } },
  ],
};
const json = `${JSON.stringify(collection)}\n`;
mkdirSync('public/data', { recursive: true });
writeFileSync(OUT, json);
const points = [...land, ...lakes].flat(2).length;
console.log(`${land.length} land and ${lakes.length} lake polygons, ${points} points`);
console.log(`Wrote ${OUT}: ${(json.length / 1024).toFixed(0)} KB, gzip ${(gzipSync(json).length / 1024).toFixed(0)} KB`);
