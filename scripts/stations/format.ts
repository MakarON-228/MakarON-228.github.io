// Формат `public/data/stations.json` и `public/data/railways.json` — контракт между скриптом и островом RailMap.

import type { Assigned, Group, NearestAccuracy, NearestOptions, Source } from './assign.ts';
import type { Kind } from './normalize.ts';
import { ROADS } from './roads.ts';

export interface GroupInfo {
  id: Group;
  name: string;
  nameEn: string;
  wikidata?: string;
}

/** 16 дорог в порядке SPEC, затем другие операторы и неопределённые. Индекс здесь = `group` в строке. */
export const GROUPS: readonly GroupInfo[] = [
  ...ROADS.map((r) => ({ id: r.id, name: r.name, nameEn: r.nameEn, wikidata: r.wikidata })),
  { id: 'other', name: 'Другие железные дороги', nameEn: 'Other railways' },
  { id: 'unassigned', name: 'Дорога не определена', nameEn: 'Unassigned' },
];

export const FIELDS = ['name', 'lon', 'lat', 'group', 'esr', 'kind', 'operator'] as const;

/** kind: 0 — станция, 1 — платформа; operator — индекс в `operators`, только у группы `other`. */
export type Row = [name: string, lon: number, lat: number, group: number, esr: string | null, kind: 0 | 1, operator?: number];

export interface StationsFile {
  /** Момент среза OSM, по которому сделана выгрузка (`timestamp_osm_base` из Overpass). */
  extracted: string;
  fields: typeof FIELDS;
  operators: string[];
  rows: Row[];
}

export interface GroupSummary extends GroupInfo {
  stations: number;
  halts: number;
}

export interface RailwaysFile {
  extracted: string;
  groups: GroupSummary[];
  /** Сколько точек решено каждым шагом. */
  coverage: Record<Source, number>;
  unassignedShare: number;
  nearest: NearestOptions & NearestAccuracy;
}

const groupIndex = new Map<Group, number>(GROUPS.map((g, i) => [g.id, i]));

export function buildFiles(
  assigned: readonly Assigned[],
  meta: { extracted: string; coverage: Record<Source, number>; nearest: NearestOptions & NearestAccuracy },
): { stations: StationsFile; railways: RailwaysFile } {
  const operators = [...new Set(assigned.flatMap((s) => (s.otherOperator ? [s.otherOperator] : [])))].sort(ruCompare);
  const opIndex = new Map(operators.map((o, i) => [o, i]));
  const sorted = [...assigned].sort(
    (a, b) =>
      groupIndex.get(a.group)! - groupIndex.get(b.group)! ||
      ruCompare(a.name, b.name) ||
      a.kind.localeCompare(b.kind) ||
      a.lon - b.lon ||
      a.lat - b.lat,
  );
  const rows = sorted.map((s): Row => {
    const row: Row = [s.name, s.lon, s.lat, groupIndex.get(s.group)!, s.esr, s.kind === 'station' ? 0 : 1];
    if (s.otherOperator) row.push(opIndex.get(s.otherOperator)!);
    return row;
  });
  const groups = GROUPS.map((g) => ({
    ...g,
    stations: assigned.filter((s) => s.group === g.id && s.kind === 'station').length,
    halts: assigned.filter((s) => s.group === g.id && s.kind === 'halt').length,
  }));
  const unassigned = assigned.filter((s) => s.group === 'unassigned').length;
  return {
    stations: { extracted: meta.extracted, fields: FIELDS, operators, rows },
    railways: {
      extracted: meta.extracted,
      groups,
      coverage: meta.coverage,
      unassignedShare: round(unassigned / assigned.length, 4),
      nearest: meta.nearest,
    },
  };
}

/** Одна строка на станцию — дифф при перевыгрузке читается построчно. */
export function serializeStations(file: StationsFile): string {
  const head = JSON.stringify({ extracted: file.extracted, fields: file.fields, operators: file.operators });
  const rows = file.rows.map((r) => JSON.stringify(r)).join(',\n');
  return `${head.slice(0, -1)},"rows":[\n${rows}\n]}\n`;
}

export interface DecodedRow {
  name: string;
  lon: number;
  lat: number;
  group: Group;
  esr: string | null;
  kind: Kind;
  operator?: string;
}

export function decodeRows(file: StationsFile): DecodedRow[] {
  return file.rows.map(([name, lon, lat, group, esr, kind, operator]) => {
    const row: DecodedRow = { name, lon, lat, group: GROUPS[group]!.id, esr, kind: kind === 0 ? 'station' : 'halt' };
    if (operator !== undefined) row.operator = file.operators[operator]!;
    return row;
  });
}

function ruCompare(a: string, b: string): number {
  return a.localeCompare(b, 'ru');
}

function round(x: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(x * f) / f;
}
