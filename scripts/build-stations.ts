// Выгрузка станций России из OpenStreetMap и определение дороги РЖД (SPEC.md §7.4).
// Запуск вручную раз в несколько месяцев: `npm run stations`; результат коммитится.
// `--cached` — взять сырые ответы из `.cache/` (недостающие скачать) и перепрогнать, например после правок в overrides.
// `--k=3 --radius=50` — параметры шага 4 для подбора по leave-one-out точности; такой прогон только печатает отчёт.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import type { NearestOptions, WikidataClaim, WikidataProp } from './stations/assign.ts';
import {
  NEAREST,
  WIKIDATA_PROPS,
  assign,
  coverage,
  esrAnomalies,
  nearestAccuracy,
  parseOverrides,
  roadsFromClaims,
  wikidataCheck,
} from './stations/assign.ts';
import { buildFiles, serializeStations } from './stations/format.ts';
import type { OsmElement } from './stations/normalize.ts';
import { normalize } from './stations/normalize.ts';
import { checkReferences } from './stations/references.ts';

const USER_AGENT = 'makaron-228.github.io station extract (https://github.com/MakarON-228/MakarON-228.github.io)';
// overpass-api.de без User-Agent отвечает 406 и часто перегружен — поэтому зеркала по очереди.
const OVERPASS = [
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
const WIKIDATA = 'https://query.wikidata.org/sparql';
const CACHE = '.cache';
const OVERRIDES = 'data/railway-overrides.csv';
const OUT_STATIONS = 'public/data/stations.json';
const OUT_RAILWAYS = 'public/data/railways.json';
const MAX_UNASSIGNED = 0.05;
// Зеркало со срезом старше этого — отстающее, его ответ не берём.
const MAX_SNAPSHOT_AGE_DAYS = 14;

const args = process.argv.slice(2);
const cached = args.includes('--cached');
const nearest: NearestOptions = {
  k: Number(flag('k') ?? NEAREST.k),
  radiusKm: Number(flag('radius') ?? NEAREST.radiusKm),
};

function flag(name: string): string | undefined {
  return args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Сырой ответ из кэша или из сети; ответ из сети кладётся в кэш. */
async function cachedFetch(name: string, fetcher: () => Promise<string>): Promise<string> {
  const path = `${CACHE}/${name}`;
  if (cached && existsSync(path)) return readFileSync(path, 'utf8');
  const body = await fetcher();
  mkdirSync(CACHE, { recursive: true });
  writeFileSync(path, body);
  return body;
}

interface OverpassResponse {
  osm3s: { timestamp_osm_base: string };
  elements: OsmElement[];
}

async function overpass(query: string): Promise<string> {
  for (let round = 0; round < 3; round++) {
    for (const url of OVERPASS) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
          body: new URLSearchParams({ data: query }),
          signal: AbortSignal.timeout(660_000),
        });
        const body = await res.text();
        // Перегруженный сервер отвечает HTML-страницей, иногда даже со статусом 200.
        if (!res.ok || !body.trimStart().startsWith('{')) {
          console.warn(`  ${url}: HTTP ${res.status}, ${body.length} bytes — next mirror`);
          continue;
        }
        const snapshot = (JSON.parse(body) as OverpassResponse).osm3s.timestamp_osm_base;
        const ageDays = (Date.now() - Date.parse(snapshot)) / 86_400_000;
        if (ageDays <= MAX_SNAPSHOT_AGE_DAYS) return body;
        console.warn(`  ${url}: snapshot ${snapshot} is ${Math.round(ageDays)} days old — next mirror`);
      } catch (error) {
        console.warn(`  ${url}: ${(error as Error).message} — next mirror`);
      }
    }
    if (round < 2) await sleep(30_000 * (round + 1));
  }
  throw new Error('Overpass: all mirrors failed');
}

function overpassQuery(railway: 'station' | 'halt'): string {
  return `[out:json][timeout:600];
area["ISO3166-1"="RU"][admin_level=2]->.ru;
nwr["railway"="${railway}"](area.ru);
out tags center;`;
}

type SparqlJson = { results: { bindings: Record<'item' | 'prop' | 'value', { value: string }>[] } };

async function sparql(query: string): Promise<SparqlJson> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(WIKIDATA, {
      method: 'POST',
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/sparql-results+json' },
      body: new URLSearchParams({ query }),
    });
    if (res.ok) return (await res.json()) as SparqlJson;
    if (attempt === 4) throw new Error(`Wikidata: HTTP ${res.status}`);
    console.warn(`  Wikidata: HTTP ${res.status}, retry ${attempt}`);
    await sleep(15_000 * attempt);
  }
}

async function wikidataClaims(qids: readonly string[]): Promise<WikidataClaim[]> {
  const claims: WikidataClaim[] = [];
  for (let i = 0; i < qids.length; i += 150) {
    const values = qids.slice(i, i + 150).map((q) => `wd:${q}`).join(' ');
    const props = WIKIDATA_PROPS.map((p) => `wdt:${p}`).join(', ');
    const query = `SELECT ?item ?prop ?value WHERE { VALUES ?item { ${values} } ?item ?prop ?value . FILTER(?prop IN (${props})) }`;
    const json = await sparql(query);
    for (const b of json.results.bindings) {
      claims.push({
        item: b.item.value.replace('http://www.wikidata.org/entity/', ''),
        prop: b.prop.value.replace('http://www.wikidata.org/prop/direct/', '') as WikidataProp,
        value: b.value.value.replace('http://www.wikidata.org/entity/', ''),
      });
    }
    await sleep(1000);
  }
  return claims;
}

interface WikidataCache {
  queried: string[];
  claims: WikidataClaim[];
}

/** Утверждения Wikidata по QID; с `--cached` докачиваются только QID, которых нет в кэше. */
async function wikidataCached(qids: readonly string[]): Promise<WikidataClaim[]> {
  const path = `${CACHE}/wikidata.json`;
  const cache: WikidataCache =
    cached && existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as WikidataCache) : { queried: [], claims: [] };
  const known = new Set(cache.queried);
  const missing = qids.filter((q) => !known.has(q));
  console.log(`Wikidata: ${qids.length} items, ${missing.length} to fetch`);
  if (missing.length > 0) {
    cache.claims.push(...(await wikidataClaims(missing)));
    cache.queried.push(...missing);
    mkdirSync(CACHE, { recursive: true });
    writeFileSync(path, JSON.stringify(cache));
  }
  const wanted = new Set(qids);
  return cache.claims.filter((c) => wanted.has(c.item));
}

const pct = (n: number, total: number) => `${((100 * n) / total).toFixed(1)} %`;

async function main() {
  console.log(cached ? 'Overpass: from .cache/' : 'Overpass: fetching stations and halts…');
  const responses: OverpassResponse[] = [];
  for (const railway of ['station', 'halt'] as const) {
    const body = await cachedFetch(`overpass-${railway}.json`, () => overpass(overpassQuery(railway)));
    responses.push(JSON.parse(body) as OverpassResponse);
  }
  // Зеркала отстают по-разному; честная дата среза — самая ранняя из двух.
  const extracted = responses.map((r) => r.osm3s.timestamp_osm_base).sort()[0]!;
  const elements = responses.flatMap((r) => r.elements);
  const { stations, dropped, duplicates } = normalize(elements);

  const qids = [...new Set(stations.flatMap((s) => (s.wikidata ? [s.wikidata] : [])))].sort();
  const claims = await wikidataCached(qids);
  const wikidata = roadsFromClaims(claims);

  const overrides = parseOverrides(readFileSync(OVERRIDES, 'utf8'));
  const assigned = assign(stations, { overrides, wikidata, nearest });
  const cover = coverage(assigned);
  const accuracy = nearestAccuracy(assigned, nearest);
  const wdCheck = wikidataCheck(stations, wikidata);
  const anomalies = esrAnomalies(assigned);
  const references = checkReferences(assigned);
  const unassigned = assigned.filter((s) => s.group === 'unassigned');
  const total = assigned.length;

  console.log(`\nOSM snapshot ${extracted}: ${elements.length} elements`);
  console.log(`Dropped: ${Object.entries(dropped).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  for (const d of duplicates.slice(0, 10)) console.log(`  duplicate ${d.osm} ${d.name} (${d.kind})`);
  const kinds = { station: 0, halt: 0 };
  for (const s of assigned) kinds[s.kind]++;
  console.log(`Kept: ${total} (${kinds.station} stations, ${kinds.halt} halts)`);

  console.log('\nRoad decided by:');
  for (const [source, n] of Object.entries(cover)) console.log(`  ${source.padEnd(9)} ${String(n).padStart(6)}  ${pct(n, total)}`);
  const other = assigned.filter((s) => s.group === 'other');
  console.log(`Other railways: ${other.length} (${pct(other.length, total)})`);
  const ops = new Map<string, number>();
  for (const s of other) ops.set(s.otherOperator ?? '?', (ops.get(s.otherOperator ?? '?') ?? 0) + 1);
  for (const [op, n] of [...ops].sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log(`  ${String(n).padStart(4)}  ${op}`);
  console.log(`Unassigned: ${unassigned.length} (${pct(unassigned.length, total)}), limit ${pct(MAX_UNASSIGNED, 1)}`);

  console.log(`\nStep 4 leave-one-out (k=${nearest.k}, R=${nearest.radiusKm} km) on ${accuracy.checked} tag-assigned points:`);
  console.log(`  answered ${pct(accuracy.answered, accuracy.checked)}, correct ${pct(accuracy.correct, accuracy.answered)} of answered`);
  console.log(`Wikidata vs tags: ${wdCheck.both} points with both, ${wdCheck.disagree.length} disagree`);
  for (const d of wdCheck.disagree.slice(0, 10)) console.log(`  ${d.osm} ${d.name}: tags ${d.tags}, wikidata ${d.wikidata}`);

  console.log(`\nESR prefix anomalies (review only): ${anomalies.length}`);
  const bySource = (s: string) => (s === 'nearest' ? 0 : s === 'wikidata' ? 1 : 2);
  for (const a of [...anomalies].sort((x, y) => bySource(x.source) - bySource(y.source)).slice(0, 25)) {
    console.log(`  ${a.osm} ${a.name} ESR ${a.esr}: ${a.group} (${a.source}), prefix says ${a.prefixRoad}`);
  }

  console.log('\nReference stations:');
  for (const r of references) console.log(`  ${r.ok ? 'ok  ' : 'FAIL'} ${r.spec.padEnd(28)} ${r.osm.padEnd(28)} → ${r.got}`);

  const failed = references.filter((r) => !r.ok).length;
  if (failed > 0 || unassigned.length / total >= MAX_UNASSIGNED) {
    console.error(`\nChecks failed (${failed} references, unassigned ${pct(unassigned.length, total)}): files not written.`);
    process.exit(1);
  }

  if (nearest.k !== NEAREST.k || nearest.radiusKm !== NEAREST.radiusKm) {
    console.log(`\nTuning run (defaults k=${NEAREST.k}, R=${NEAREST.radiusKm} km): files not written.`);
    return;
  }

  const files = buildFiles(assigned, { extracted, coverage: cover, nearest: { ...nearest, ...accuracy } });
  mkdirSync('public/data', { recursive: true });
  const stationsJson = serializeStations(files.stations);
  const railwaysJson = `${JSON.stringify(files.railways, null, 2)}\n`;
  writeFileSync(OUT_STATIONS, stationsJson);
  writeFileSync(OUT_RAILWAYS, railwaysJson);
  const kb = (s: string) => `${(Buffer.byteLength(s) / 1024).toFixed(0)} KB, gzip ${(gzipSync(s).length / 1024).toFixed(0)} KB`;
  console.log(`\nWrote ${OUT_STATIONS} (${kb(stationsJson)}) and ${OUT_RAILWAYS} (${kb(railwaysJson)})`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
