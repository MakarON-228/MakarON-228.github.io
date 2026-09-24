// Проверки закоммиченной выгрузки `public/data/*.json` (SPEC.md §7.4): эталоны, доля Unassigned, бюджет.

import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { NEAREST, isRoad, prepareSeeds, vote } from './assign';
import type { RailwaysFile, StationsFile } from './format';
import { GROUPS, decodeRows } from './format';
import { DUPLICATE_KM, distanceKm } from './normalize';
import { REFERENCES, checkReferences } from './references';

const read = (name: string) => readFileSync(new URL(`../../public/data/${name}`, import.meta.url), 'utf8');
const stationsText = read('stations.json');
const railwaysText = read('railways.json');
const stations = JSON.parse(stationsText) as StationsFile;
const railways = JSON.parse(railwaysText) as RailwaysFile;
const rows = decodeRows(stations);

describe('committed station data', () => {
  it('assigns all 16 reference stations to their roads', () => {
    const results = checkReferences(rows);
    expect(results.filter((r) => !r.ok)).toEqual([]);
    expect(results).toHaveLength(16);
  });

  it('recovers each reference station from its neighbours alone', () => {
    for (const ref of REFERENCES) {
      const i = rows.findIndex((r) => r.kind === 'station' && r.name === ref.osm);
      const others = rows.filter((r, j) => j !== i && r.group !== 'unassigned');
      expect(vote(prepareSeeds(others), rows[i]!, NEAREST), ref.spec).toBe(ref.road);
    }
  });

  it('keeps the unassigned share under 5 %', () => {
    const share = rows.filter((r) => r.group === 'unassigned').length / rows.length;
    expect(share).toBeLessThan(0.05);
    expect(railways.unassignedShare).toBeCloseTo(share, 4);
  });

  it('summarises the same counts per road as the station rows', () => {
    expect(railways.groups.map((g) => g.id)).toEqual(GROUPS.map((g) => g.id));
    for (const g of railways.groups) {
      expect(g.stations, g.id).toBe(rows.filter((r) => r.group === g.id && r.kind === 'station').length);
      expect(g.halts, g.id).toBe(rows.filter((r) => r.group === g.id && r.kind === 'halt').length);
    }
    const decided = Object.values(railways.coverage).reduce((a, b) => a + b, 0);
    expect(decided).toBe(rows.length);
  });

  it('records a trustworthy nearest-station step', () => {
    const { checked, answered, correct } = railways.nearest;
    expect(answered / checked).toBeGreaterThan(0.98);
    expect(correct / answered).toBeGreaterThan(0.98);
  });

  it('has well-formed rows inside Russia, without duplicates', () => {
    const seen = new Map<string, typeof rows>();
    for (const r of rows) {
      expect(r.lat).toBeGreaterThan(41);
      expect(r.lat).toBeLessThan(82);
      expect(r.lon).toBeGreaterThan(19);
      expect(r.lon).toBeLessThanOrEqual(180);
      expect(r.esr === null || /^\d{6}$/.test(r.esr)).toBe(true);
      expect(r.operator !== undefined, r.name).toBe(r.group === 'other');
      const key = `${r.kind}|${r.name.toLowerCase()}`;
      const same = seen.get(key) ?? [];
      expect(same.some((o) => distanceKm(o, r) < DUPLICATE_KM), r.name).toBe(false);
      seen.set(key, [...same, r]);
    }
    expect(rows.some((r) => isRoad(r.group))).toBe(true);
  });

  it('dates the extract and fits the 400 KB gzip budget together with the land layer', () => {
    expect(stations.extracted).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(railways.extracted).toBe(stations.extracted);
    const gzip = [stationsText, railwaysText, read('land.json')].reduce((n, text) => n + gzipSync(text).length, 0);
    expect(gzip).toBeLessThanOrEqual(400 * 1024);
  });
});
