// Элемент Overpass → запись станции (SPEC.md §7.4): отсев, имя, координаты, код ЕСР, дедупликация.

export interface OsmElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export type Kind = 'station' | 'halt';

export interface Station {
  /** `node/123`, `way/45` — ключ для ручных правок. */
  osm: string;
  name: string;
  lon: number;
  lat: number;
  kind: Kind;
  /** Код ЕСР из `esr:user`, только шесть цифр. */
  esr: string | null;
  branch?: string;
  operator?: string;
  wikidata?: string;
}

export type DropReason = 'not-rail' | 'disused' | 'unnamed' | 'no-coords' | 'duplicate';

const NOT_RAIL = new Set(['subway', 'light_rail', 'monorail', 'funicular', 'miniature']);

/** Радиус, в котором одноимённая станция того же типа считается тем же объектом. */
export const DUPLICATE_KM = 3;

export function cleanName(name: string): string {
  return name.replace(/\s+/g, ' ').trim();
}

export function round4(x: number): number {
  return Math.round(x * 1e4) / 1e4;
}

/** Одна запись или причина отсева. Дубли здесь не ловятся — это `dedupe`. */
export function toStation(el: OsmElement): Station | DropReason {
  const tags = el.tags ?? {};
  const kind = tags.railway === 'station' ? 'station' : tags.railway === 'halt' ? 'halt' : null;
  if (!kind || NOT_RAIL.has(tags.station ?? '')) return 'not-rail';
  if (tags.disused === 'yes' || tags.abandoned === 'yes' || tags.station === 'disused') return 'disused';
  const name = cleanName(tags.name ?? '');
  if (!name) return 'unnamed';
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (lat === undefined || lon === undefined) return 'no-coords';
  const esr = (tags['esr:user'] ?? '').trim();
  const station: Station = {
    osm: `${el.type}/${el.id}`,
    name,
    lon: round4(lon),
    lat: round4(lat),
    kind,
    esr: /^\d{6}$/.test(esr) ? esr : null,
  };
  if (tags['operator:branch']) station.branch = tags['operator:branch'].trim();
  if (tags.operator) station.operator = tags.operator.trim();
  if (/^Q\d+$/.test(tags.wikidata ?? '')) station.wikidata = tags.wikidata!;
  return station;
}

const EARTH_KM = 6371;

export function distanceKm(a: { lon: number; lat: number }, b: { lon: number; lat: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Убирает повторы: одноимённая станция того же типа ближе `DUPLICATE_KM`. Узлы идут первыми,
 * поэтому остаётся точка-узел, а полигон или отношение с тем же именем отбрасывается.
 */
export function dedupe(stations: readonly Station[]): { kept: Station[]; dropped: Station[] } {
  const order = (s: Station) => (s.osm.startsWith('node/') ? 0 : 1);
  const sorted = [...stations].sort((a, b) => order(a) - order(b));
  const byName = new Map<string, Station[]>();
  const kept: Station[] = [];
  const dropped: Station[] = [];
  for (const s of sorted) {
    const key = `${s.kind}|${s.name.toLowerCase()}`;
    const same = byName.get(key) ?? [];
    if (same.some((o) => distanceKm(o, s) < DUPLICATE_KM)) {
      dropped.push(s);
      continue;
    }
    same.push(s);
    byName.set(key, same);
    kept.push(s);
  }
  return { kept, dropped };
}

/** Весь разбор выгрузки: записи и счётчики отсева по причинам. */
export function normalize(elements: readonly OsmElement[]): {
  stations: Station[];
  dropped: Record<DropReason, number>;
  duplicates: Station[];
} {
  const dropped: Record<DropReason, number> = { 'not-rail': 0, disused: 0, unnamed: 0, 'no-coords': 0, duplicate: 0 };
  const candidates: Station[] = [];
  for (const el of elements) {
    const s = toStation(el);
    if (typeof s === 'string') dropped[s]++;
    else candidates.push(s);
  }
  const { kept, dropped: duplicates } = dedupe(candidates);
  dropped.duplicate = duplicates.length;
  return { stations: kept, dropped, duplicates };
}
