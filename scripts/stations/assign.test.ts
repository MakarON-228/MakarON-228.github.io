import { describe, expect, it } from 'vitest';
import type { Assigned, WikidataClaim } from './assign';
import {
  assign,
  coverage,
  esrAnomalies,
  fromTags,
  nearestAccuracy,
  parseOverrides,
  prepareSeeds,
  roadsFromClaims,
  vote,
  wikidataCheck,
} from './assign';
import type { Station } from './normalize';

const st = (osm: string, lat: number, lon: number, extra: Partial<Station> = {}): Station => ({
  osm,
  name: osm,
  lat,
  lon,
  kind: 'station',
  esr: null,
  ...extra,
});
const MOSCOW = { operator: 'ОАО «РЖД»', branch: 'Московская железная дорога' };
const GORKY = { operator: 'ОАО «РЖД»', branch: 'Горьковская железная дорога' };

describe('manual overrides', () => {
  it('parses rows after the header, skipping comments and keeping commas in notes', () => {
    const map = parseOverrides('# правки\nosm,road,note\n\nnode/1,moscow,typo, see OSM\nway/2,other,Завод\n');
    expect(map.get('node/1')).toEqual({ group: 'moscow', note: 'typo, see OSM' });
    expect(map.get('way/2')).toEqual({ group: 'other', note: 'Завод' });
  });

  it('rejects a missing header, bad ids, unknown roads and repeated rows', () => {
    expect(() => parseOverrides('node/1,moscow,x')).toThrow(/header/);
    expect(() => parseOverrides('osm,road,note\nstation/1,moscow,')).toThrow(/bad OSM id/);
    expect(() => parseOverrides('osm,road,note\nnode/1,crimean,')).toThrow(/unknown road/);
    expect(() => parseOverrides('osm,road,note\nnode/1,moscow,\nnode/1,gorky,')).toThrow(/twice/);
  });
});

describe('road from OSM tags', () => {
  it('takes the road from operator:branch, then from operator', () => {
    expect(fromTags(MOSCOW)).toEqual({ group: 'moscow' });
    expect(fromTags({ operator: 'Октябрьская железная дорога' })).toEqual({ group: 'oktyabrskaya' });
  });

  it('leaves RZD without a road and untagged stations to later steps', () => {
    expect(fromTags({ operator: 'ОАО «РЖД»' })).toBeNull();
    expect(fromTags({})).toBeNull();
    expect(fromTags({ operator: 'Информация отсутствует' })).toBeNull();
  });

  it('puts named non-RZD operators into "other", preferring the branch name', () => {
    expect(fromTags({ operator: 'ФГУП «КЖД»', branch: 'Крымская железная дорога' })).toEqual({
      group: 'other',
      operator: 'Крымская железная дорога',
    });
    expect(fromTags({ operator: 'КТЖ' })).toEqual({ group: 'other', operator: 'КТЖ' });
  });
});

describe('road from Wikidata', () => {
  const claim = (item: string, prop: WikidataClaim['prop'], value: string): WikidataClaim => ({ item, prop, value });

  it('reads the road from "owned by" (P127); RZD as operator (P137) is not a road', () => {
    const map = roadsFromClaims([claim('Q1', 'P137', 'Q660770'), claim('Q1', 'P127', 'Q1765011')]);
    expect(map.get('Q1')).toBe('moscow');
  });

  it('falls back to later properties and skips items naming two roads', () => {
    const map = roadsFromClaims([
      claim('Q2', 'P137', 'Q660770'),
      claim('Q2', 'P361', 'Q1351775'),
      claim('Q3', 'P127', 'Q1765011'),
      claim('Q3', 'P127', 'Q1351775'),
      claim('Q3', 'P361', 'Q1765011'),
    ]);
    expect(map.get('Q2')).toBe('gorky');
    expect(map.has('Q3')).toBe(false);
  });
});

describe('nearest assigned stations', () => {
  const opts = { k: 3, radiusKm: 50 };
  const seeds = prepareSeeds([
    { lat: 55.0, lon: 37.0, group: 'moscow' },
    { lat: 55.05, lon: 37.0, group: 'moscow' },
    { lat: 55.1, lon: 37.0, group: 'gorky' },
    { lat: 60.0, lon: 50.0, group: 'other' },
    { lat: 60.05, lon: 50.0, group: 'other' },
    { lat: 60.1, lon: 50.0, group: 'northern' },
  ]);

  it('follows the majority of the k nearest', () => {
    expect(vote(seeds, { lat: 55.02, lon: 37.0 }, opts)).toBe('moscow');
  });

  it('stays unassigned next to other operators or far from everything', () => {
    expect(vote(seeds, { lat: 60.02, lon: 50.0 }, opts)).toBe('unassigned');
    expect(vote(seeds, { lat: 45.0, lon: 40.0 }, opts)).toBe('unassigned');
  });

  it('requires a strict majority and can leave a point out', () => {
    expect(vote(seeds, { lat: 55.1, lon: 37.0 }, { k: 2, radiusKm: 50 })).toBe('unassigned');
    expect(vote(seeds, { lat: 55.1, lon: 37.0 }, { k: 1, radiusKm: 50 }, 2)).toBe('moscow');
  });
});

describe('assignment pipeline', () => {
  const stations = [
    st('node/1', 55.0, 37.0, MOSCOW),
    st('node/2', 55.01, 37.0, MOSCOW),
    st('node/3', 55.02, 37.0, { ...GORKY }), // ошибка тегов, исправлена вручную
    st('node/4', 55.03, 37.0, { wikidata: 'Q9' }),
    st('node/5', 55.04, 37.0), // без тегов — по соседям
    st('node/6', 55.05, 37.0, { operator: 'Уральская Сталь' }),
    st('node/7', 70.0, 100.0), // далеко от всех
    st('node/8', 55.06, 37.0, MOSCOW),
  ];
  const assigned = assign(stations, {
    overrides: parseOverrides('osm,road,note\nnode/3,moscow,wrong branch in OSM\nnode/8,unassigned,'),
    wikidata: new Map([['Q9', 'moscow']]),
    nearest: { k: 3, radiusKm: 50 },
  });
  const by = (osm: string) => assigned.find((s) => s.osm === osm)!;

  it('applies steps in priority order', () => {
    expect(by('node/1')).toMatchObject({ group: 'moscow', source: 'tags' });
    expect(by('node/3')).toMatchObject({ group: 'moscow', source: 'override' });
    expect(by('node/4')).toMatchObject({ group: 'moscow', source: 'wikidata' });
    expect(by('node/5')).toMatchObject({ group: 'moscow', source: 'nearest' });
    expect(by('node/6')).toMatchObject({ group: 'other', source: 'tags', otherOperator: 'Уральская Сталь' });
    expect(by('node/7')).toMatchObject({ group: 'unassigned', source: 'none' });
    expect(by('node/8')).toMatchObject({ group: 'unassigned', source: 'override' });
  });

  it('counts decisions by step', () => {
    expect(coverage(assigned)).toEqual({ override: 2, tags: 3, wikidata: 1, nearest: 1, none: 1 });
  });

  it('measures the nearest step by leaving tag-assigned stations out', () => {
    expect(nearestAccuracy(assigned, { k: 3, radiusKm: 50 })).toEqual({ checked: 2, answered: 2, correct: 2 });
  });

  it('compares tags with Wikidata where both exist', () => {
    const check = wikidataCheck([st('node/1', 55, 37, { ...GORKY, wikidata: 'Q9' })], new Map([['Q9', 'moscow']]));
    expect(check).toEqual({ both: 1, disagree: [{ osm: 'node/1', name: 'node/1', tags: 'gorky', wikidata: 'moscow' }] });
  });
});

describe('ESR prefix hint', () => {
  it('flags stations whose road differs from the dominant road of their ESR prefix', () => {
    const rows: Assigned[] = Array.from({ length: 10 }, (_, i) => ({
      ...st(`node/${i}`, 55, 37, { esr: `19${String(i).padStart(4, '0')}` }),
      group: 'moscow' as const,
      source: 'tags' as const,
    }));
    rows.push({ ...st('node/99', 55, 37, { esr: '199999' }), group: 'oktyabrskaya', source: 'nearest' });
    const anomalies = esrAnomalies(rows);
    expect(anomalies).toEqual([
      { osm: 'node/99', name: 'node/99', esr: '199999', group: 'oktyabrskaya', source: 'nearest', prefixRoad: 'moscow' },
    ]);
  });

  it('stays silent when no road dominates a prefix', () => {
    const rows: Assigned[] = Array.from({ length: 12 }, (_, i) => ({
      ...st(`node/${i}`, 55, 37, { esr: `60${String(i).padStart(4, '0')}` }),
      group: i % 2 ? ('privolzhskaya' as const) : ('south-eastern' as const),
      source: 'tags' as const,
    }));
    expect(esrAnomalies(rows)).toEqual([]);
  });
});
