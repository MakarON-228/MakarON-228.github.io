// Данные карты станций (SPEC.md §7.4): строки `stations.json`, группы из `railways.json`, рамки и порядок панели.

import type { GroupSummary, StationsFile } from '../../../scripts/stations/format';

export interface Point {
  name: string;
  lon: number;
  lat: number;
  /** Индекс в `railways.json` → groups: 16 дорог, затем `other` и `unassigned`. */
  group: number;
  esr: string | null;
  halt: boolean;
  /** Оператор из OSM — только у группы `other`. */
  operator?: string;
}

export function decode(file: StationsFile): Point[] {
  return file.rows.map(([name, lon, lat, group, esr, kind, operator]) => {
    const p: Point = { name, lon, lat, group, esr, halt: kind === 1 };
    if (operator !== undefined) p.operator = file.operators[operator]!;
    return p;
  });
}

export interface Bounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

/** Рамка точек выбранных групп (пустой выбор — все); платформы учитываются, только если показаны. */
export function boundsOf(points: readonly Point[], groups: ReadonlySet<number>, withHalts: boolean): Bounds | null {
  let b: Bounds | null = null;
  for (const p of points) {
    if (p.halt && !withHalts) continue;
    if (groups.size > 0 && !groups.has(p.group)) continue;
    b = b
      ? { west: Math.min(b.west, p.lon), south: Math.min(b.south, p.lat), east: Math.max(b.east, p.lon), north: Math.max(b.north, p.lat) }
      : { west: p.lon, south: p.lat, east: p.lon, north: p.lat };
  }
  return b;
}

/** Что острову нужно знать о группе из `railways.json`. */
export type GroupInfo = Pick<GroupSummary, 'id' | 'nameEn' | 'stations' | 'halts'>;

export type SortMode = 'size' | 'name';

export const countOf = (g: GroupInfo, withHalts: boolean) => g.stations + (withHalts ? g.halts : 0);

/**
 * Порядок строк панели: 16 дорог по размеру или по алфавиту (английские названия),
 * «Other railways» и «Unassigned» всегда в конце — это не дороги.
 */
export function sortGroups(groups: readonly GroupInfo[], mode: SortMode, withHalts: boolean): number[] {
  const index = groups.map((_, i) => i);
  const tail = (i: number) => (groups[i]!.id === 'other' || groups[i]!.id === 'unassigned' ? 1 : 0);
  return index.sort((a, b) => {
    const ga = groups[a]!;
    const gb = groups[b]!;
    return (
      tail(a) - tail(b) ||
      (tail(a) ? a - b : 0) ||
      (mode === 'size' ? countOf(gb, withHalts) - countOf(ga, withHalts) : 0) ||
      ga.nameEn.localeCompare(gb.nameEn, 'en')
    );
  });
}

/** Сколько точек видно при выборе (пустой выбор — все группы). */
export function visibleCount(groups: readonly GroupInfo[], selected: ReadonlySet<number>, withHalts: boolean) {
  let stations = 0;
  let halts = 0;
  groups.forEach((g, i) => {
    if (selected.size > 0 && !selected.has(i)) return;
    stations += g.stations;
    halts += withHalts ? g.halts : 0;
  });
  return { stations, halts };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** «22 Sep 2026» из ISO-даты среза OSM — без Intl: его «Sept» зависит от версии ICU. */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
