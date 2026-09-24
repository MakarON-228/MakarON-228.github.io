// Определение дороги для каждой станции (SPEC.md §7.4). Приоритет:
// ручная правка → теги OSM → Wikidata → большинство ближайших уже определённых станций.

import type { Station } from './normalize.ts';
import type { RoadId } from './roads.ts';
import { isRoadId, isRzdGeneric, matchRoad, roadByQid } from './roads.ts';

export type Group = RoadId | 'other' | 'unassigned';
export type Source = 'override' | 'tags' | 'wikidata' | 'nearest' | 'none';

export interface Assigned extends Station {
  group: Group;
  source: Source;
  /** Оператор из OSM — только у группы `other`. */
  otherOperator?: string;
}

export const isRoad = (g: Group): g is RoadId => g !== 'other' && g !== 'unassigned';

// ─── Шаг 1: ручные правки ────────────────────────────────────────────────────

export interface Override {
  group: Group;
  note: string;
}

/**
 * `data/railway-overrides.csv`: `osm,road,note`; road — id дороги, `other` или `unassigned`.
 * Строки с `#` — комментарии. Ошибка в файле — исключение: правки не должны теряться молча.
 */
export function parseOverrides(csv: string): Map<string, Override> {
  const result = new Map<string, Override>();
  const lines = csv.split(/\r?\n/).map((l) => l.trim());
  let header = false;
  lines.forEach((line, i) => {
    if (!line || line.startsWith('#')) return;
    if (!header) {
      if (line !== 'osm,road,note') throw new Error(`overrides: expected header "osm,road,note", got "${line}"`);
      header = true;
      return;
    }
    const [osm = '', road = '', ...rest] = line.split(',');
    const where = `overrides line ${i + 1}`;
    if (!/^(node|way|relation)\/\d+$/.test(osm)) throw new Error(`${where}: bad OSM id "${osm}"`);
    if (!isRoadId(road) && road !== 'other' && road !== 'unassigned') throw new Error(`${where}: unknown road "${road}"`);
    if (result.has(osm)) throw new Error(`${where}: ${osm} is listed twice`);
    result.set(osm, { group: road, note: rest.join(',').trim() });
  });
  return result;
}

// ─── Шаг 2: теги OSM ─────────────────────────────────────────────────────────

export type TagVerdict = { group: RoadId } | { group: 'other'; operator: string } | null;

// «Информация отсутствует», «нет данных» — заглушка вместо оператора, а не оператор.
const PLACEHOLDER = /^(?:информация отсутствует|нет данных|неизвестно|unknown|\?+)$/i;

const meaningful = (text: string | undefined) => (text && !PLACEHOLDER.test(text.trim()) ? text : undefined);

/**
 * Дорога из `operator:branch`, затем из `operator`. Если назван оператор не РЖД — `other`.
 * РЖД без дороги («ОАО «РЖД»») и отсутствие тегов — null: решают следующие шаги.
 */
export function fromTags(s: Pick<Station, 'branch' | 'operator'>): TagVerdict {
  const branch = meaningful(s.branch);
  const operator = meaningful(s.operator);
  const road = matchRoad(branch) ?? matchRoad(operator);
  if (road) return { group: road };
  if (isRzdGeneric(operator) || isRzdGeneric(branch)) return null;
  const other = branch ?? operator;
  return other ? { group: 'other', operator: other } : null;
}

// ─── Шаг 3: Wikidata ─────────────────────────────────────────────────────────

export type WikidataProp = 'P127' | 'P137' | 'P361';

export interface WikidataClaim {
  item: string;
  prop: WikidataProp;
  value: string;
}

/** Дорога лежит в P127 «владелец»; P137 «оператор» и P361 «часть» — запасные. */
export const WIKIDATA_PROPS: readonly WikidataProp[] = ['P127', 'P137', 'P361'];

/**
 * QID станции → дорога. Свойства смотрятся по порядку; первое, где названа дорога, решает.
 * Если в нём названы две разные дороги — станция пропускается.
 */
export function roadsFromClaims(claims: readonly WikidataClaim[]): Map<string, RoadId> {
  const byItem = new Map<string, WikidataClaim[]>();
  for (const c of claims) byItem.set(c.item, [...(byItem.get(c.item) ?? []), c]);
  const result = new Map<string, RoadId>();
  for (const [item, list] of byItem) {
    for (const prop of WIKIDATA_PROPS) {
      const roads = new Set(list.filter((c) => c.prop === prop).map((c) => roadByQid(c.value)));
      roads.delete(null);
      if (roads.size === 0) continue;
      if (roads.size === 1) result.set(item, [...roads][0]!);
      break;
    }
  }
  return result;
}

// ─── Шаг 4: ближайшие станции ────────────────────────────────────────────────

export interface NearestOptions {
  k: number;
  radiusKm: number;
}

// Подобрано по leave-one-out на выгрузке 2026-09: k = 3 даёт ≈ 99.4 % верных при 99.4 % отвеченных;
// k = 1 теряет ответы, k ≥ 5 — точность у границ дорог.
export const NEAREST: NearestOptions = { k: 3, radiusKm: 50 };

const EARTH_KM = 6371;

export interface Seeds {
  xyz: Float64Array;
  groups: Group[];
}

/** Уже определённые станции как точки на единичной сфере: хорда монотонна по расстоянию. */
export function prepareSeeds(points: readonly { lon: number; lat: number; group: Group }[]): Seeds {
  const xyz = new Float64Array(points.length * 3);
  points.forEach((p, i) => xyz.set(unit(p), i * 3));
  return { xyz, groups: points.map((p) => p.group) };
}

function unit(p: { lon: number; lat: number }): [number, number, number] {
  const lat = (p.lat * Math.PI) / 180;
  const lon = (p.lon * Math.PI) / 180;
  return [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)];
}

/**
 * Голос k ближайших определённых станций в радиусе. Дорога — только при строгом большинстве найденных;
 * если побеждает `other` или рядом никого — `unassigned`. `exclude` — индекс точки, которую не учитывать.
 */
export function vote(seeds: Seeds, at: { lon: number; lat: number }, opts: NearestOptions, exclude = -1): Group {
  const [x, y, z] = unit(at);
  const maxChord2 = (2 * Math.sin(opts.radiusKm / (2 * EARTH_KM))) ** 2;
  const best: { d: number; i: number }[] = [];
  const { xyz } = seeds;
  for (let i = 0; i < seeds.groups.length; i++) {
    if (i === exclude) continue;
    const dx = xyz[i * 3]! - x;
    const dy = xyz[i * 3 + 1]! - y;
    const dz = xyz[i * 3 + 2]! - z;
    const d = dx * dx + dy * dy + dz * dz;
    if (d > maxChord2) continue;
    if (best.length === opts.k && d >= best[best.length - 1]!.d) continue;
    let j = best.length;
    while (j > 0 && best[j - 1]!.d > d) j--;
    best.splice(j, 0, { d, i });
    if (best.length > opts.k) best.pop();
  }
  const counts = new Map<Group, number>();
  for (const b of best) {
    const g = seeds.groups[b.i]!;
    counts.set(g, (counts.get(g) ?? 0) + 1);
  }
  for (const [g, n] of counts) {
    if (n * 2 > best.length) return isRoad(g) ? g : 'unassigned';
  }
  return 'unassigned';
}

// ─── Весь конвейер ───────────────────────────────────────────────────────────

export interface AssignInput {
  overrides?: ReadonlyMap<string, Override>;
  /** QID станции → дорога, из `roadsFromClaims`. */
  wikidata?: ReadonlyMap<string, RoadId>;
  nearest?: NearestOptions;
}

/** Опорные точки для шага 4: всё, что решено шагами 1–3, кроме явного `unassigned`. */
export function seedsOf(assigned: readonly Assigned[]): Assigned[] {
  return assigned.filter((s) => s.source !== 'nearest' && s.source !== 'none' && s.group !== 'unassigned');
}

export function assign(stations: readonly Station[], input: AssignInput = {}): Assigned[] {
  const { overrides = new Map(), wikidata = new Map(), nearest = NEAREST } = input;
  const pending: number[] = [];
  const result = stations.map((s, i): Assigned => {
    const tags = fromTags(s);
    const override = overrides.get(s.osm);
    if (override) {
      const operator = override.group !== 'other' ? undefined : tags?.group === 'other' ? tags.operator : override.note;
      return withOperator({ ...s, group: override.group, source: 'override' }, operator);
    }
    if (tags) return withOperator({ ...s, group: tags.group, source: 'tags' }, tags.group === 'other' ? tags.operator : undefined);
    const road = s.wikidata ? wikidata.get(s.wikidata) : undefined;
    if (road) return { ...s, group: road, source: 'wikidata' };
    pending.push(i);
    return { ...s, group: 'unassigned', source: 'none' };
  });
  const seeds = prepareSeeds(seedsOf(result));
  for (const i of pending) {
    const s = result[i]!;
    const group = vote(seeds, s, nearest);
    if (group !== 'unassigned') result[i] = { ...s, group, source: 'nearest' };
  }
  return result;
}

function withOperator(s: Assigned, operator: string | undefined): Assigned {
  return operator ? { ...s, otherOperator: operator } : s;
}

// ─── Проверки для отчёта ─────────────────────────────────────────────────────

export function coverage(assigned: readonly Assigned[]): Record<Source, number> {
  const result: Record<Source, number> = { override: 0, tags: 0, wikidata: 0, nearest: 0, none: 0 };
  for (const s of assigned) result[s.source]++;
  return result;
}

export interface NearestAccuracy {
  /** Станций, у которых дорога известна по тегам. */
  checked: number;
  /** Сколько из них шаг 4 определил бы (нашлось большинство). */
  answered: number;
  correct: number;
}

/**
 * Leave-one-out: у каждой станции с дорогой из тегов «забываем» дорогу и спрашиваем соседей.
 * Показывает, насколько можно верить шагу 4.
 */
export function nearestAccuracy(assigned: readonly Assigned[], opts: NearestOptions = NEAREST): NearestAccuracy {
  const pool = seedsOf(assigned);
  const seeds = prepareSeeds(pool);
  const result: NearestAccuracy = { checked: 0, answered: 0, correct: 0 };
  pool.forEach((s, i) => {
    if (s.source !== 'tags' || !isRoad(s.group)) return;
    result.checked++;
    const guess = vote(seeds, s, opts, i);
    if (guess === 'unassigned') return;
    result.answered++;
    if (guess === s.group) result.correct++;
  });
  return result;
}

export interface WikidataCheck {
  /** Станций, у которых дорога есть и в тегах, и в Wikidata. */
  both: number;
  disagree: { osm: string; name: string; tags: RoadId; wikidata: RoadId }[];
}

/** Сверка двух независимых источников там, где есть оба. */
export function wikidataCheck(stations: readonly Station[], wikidata: ReadonlyMap<string, RoadId>): WikidataCheck {
  const result: WikidataCheck = { both: 0, disagree: [] };
  for (const s of stations) {
    const tags = fromTags(s);
    const wd = s.wikidata ? wikidata.get(s.wikidata) : undefined;
    if (!tags || tags.group === 'other' || !wd) continue;
    result.both++;
    if (tags.group !== wd) result.disagree.push({ osm: s.osm, name: s.name, tags: tags.group, wikidata: wd });
  }
  return result;
}

export interface EsrAnomaly {
  osm: string;
  name: string;
  esr: string;
  group: RoadId;
  source: Source;
  /** Дорога, которой принадлежит большинство станций с тем же префиксом ЕСР. */
  prefixRoad: RoadId;
}

/**
 * Префикс ЕСР — подсказка, не источник истины (SPEC.md §7.4). Для каждого двузначного префикса
 * по самим данным находится доминирующая дорога (≥ `share` станций, не меньше `min`); станции другой
 * дороги с этим префиксом выводятся в отчёт на ручную проверку. На назначение дороги это не влияет.
 */
export function esrAnomalies(assigned: readonly Assigned[], share = 0.8, min = 10): EsrAnomaly[] {
  const byPrefix = new Map<string, Map<RoadId, number>>();
  for (const s of assigned) {
    if (!s.esr || !isRoad(s.group)) continue;
    const counts = byPrefix.get(s.esr.slice(0, 2)) ?? new Map<RoadId, number>();
    counts.set(s.group, (counts.get(s.group) ?? 0) + 1);
    byPrefix.set(s.esr.slice(0, 2), counts);
  }
  const dominant = new Map<string, RoadId>();
  for (const [prefix, counts] of byPrefix) {
    const total = [...counts.values()].reduce((a, b) => a + b, 0);
    const [road, n] = [...counts].sort((a, b) => b[1] - a[1])[0]!;
    if (total >= min && n / total >= share) dominant.set(prefix, road);
  }
  const result: EsrAnomaly[] = [];
  for (const s of assigned) {
    if (!s.esr || !isRoad(s.group)) continue;
    const prefixRoad = dominant.get(s.esr.slice(0, 2));
    if (prefixRoad && prefixRoad !== s.group) {
      result.push({ osm: s.osm, name: s.name, esr: s.esr, group: s.group, source: s.source, prefixRoad });
    }
  }
  return result;
}
