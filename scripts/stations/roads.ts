// 16 дорог РЖД (SPEC.md §7.4) и распознавание дороги в тегах OSM.
// Названия ru/en и QID — из Wikidata; порядок — как в SPEC.

export const ROADS = [
  { id: 'oktyabrskaya', stem: 'октябрьск', name: 'Октябрьская железная дорога', nameEn: 'Oktyabrskaya Railway', wikidata: 'Q1327441' },
  { id: 'kaliningrad', stem: 'калининградск', name: 'Калининградская железная дорога', nameEn: 'Kaliningrad Railway', wikidata: 'Q1552725' },
  { id: 'moscow', stem: 'московск', name: 'Московская железная дорога', nameEn: 'Moscow Railway', wikidata: 'Q1765011' },
  { id: 'gorky', stem: 'горьковск', name: 'Горьковская железная дорога', nameEn: 'Gorky Railway', wikidata: 'Q1351775' },
  { id: 'northern', stem: 'северн', name: 'Северная железная дорога', nameEn: 'Northern Railway', wikidata: 'Q1946844' },
  { id: 'north-caucasus', stem: 'северо-кавказск', name: 'Северо-Кавказская железная дорога', nameEn: 'North Caucasus Railway', wikidata: 'Q1666874' },
  { id: 'south-eastern', stem: 'юго-восточн', name: 'Юго-Восточная железная дорога', nameEn: 'South Eastern Railway', wikidata: 'Q1529921' },
  { id: 'privolzhskaya', stem: 'приволжск', name: 'Приволжская железная дорога', nameEn: 'Privolzhskaya Railway', wikidata: 'Q1542016' },
  { id: 'kuybyshev', stem: 'куйбышевск', name: 'Куйбышевская железная дорога', nameEn: 'Kuybyshev Railway', wikidata: 'Q1791315' },
  { id: 'sverdlovsk', stem: 'свердловск', name: 'Свердловская железная дорога', nameEn: 'Sverdlovsk Railway', wikidata: 'Q2095427' },
  { id: 'south-urals', stem: 'южно-уральск', name: 'Южно-Уральская железная дорога', nameEn: 'South Urals Railway', wikidata: 'Q1567889' },
  { id: 'west-siberian', stem: 'западно-сибирск', name: 'Западно-Сибирская железная дорога', nameEn: 'West Siberian Railway', wikidata: 'Q595308' },
  { id: 'krasnoyarsk', stem: 'красноярск', name: 'Красноярская железная дорога', nameEn: 'Krasnoyarsk Railway', wikidata: 'Q1573850' },
  { id: 'east-siberian', stem: 'восточно-сибирск', name: 'Восточно-Сибирская железная дорога', nameEn: 'East Siberian Railway', wikidata: 'Q143784' },
  { id: 'trans-baikal', stem: 'забайкальск', name: 'Забайкальская железная дорога', nameEn: 'Trans-Baikal Railway', wikidata: 'Q1573855' },
  { id: 'far-eastern', stem: 'дальневосточн', name: 'Дальневосточная железная дорога', nameEn: 'Far Eastern Railway', wikidata: 'Q1158067' },
] as const;

export type RoadId = (typeof ROADS)[number]['id'];

export const ROAD_IDS: readonly RoadId[] = ROADS.map((r) => r.id);

/** Нижний регистр, ё → е, тире между словами → пробел, тире внутри слова → дефис, пробелы сжаты. */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+[‐‑‒–—−-]+\s+/g, ' ')
    .replace(/[‐‑‒–—−]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

// «<прилагательное> железная дорога | ж. д. | ЖД» в любом падеже. Аббревиатуры дорог не разбираются
// намеренно: «КЖД» — и Калининградская, и Крымская.
const RAILWAY = String.raw`\s+(?:железн(?:ая|ой|ую)\s+дорог(?:а|и|е|у|ой)|ж\.?\s?д\.?(?![а-я]))`;
const ROAD_PATTERNS = ROADS.map((road) => ({
  id: road.id,
  ru: new RegExp(String.raw`(?<![а-я-])${road.stem}(?:ая|ой|ую)${RAILWAY}`),
  en: new RegExp(String.raw`(?<![a-z-])${road.nameEn.toLowerCase()}(?![a-z])`),
}));

/** Дорога, названная в тексте тега, или null. Две разные дороги в одном тексте — тоже null. */
export function matchRoad(text: string | undefined): RoadId | null {
  if (!text) return null;
  const t = normalizeText(text);
  const found = ROAD_PATTERNS.filter((p) => p.ru.test(t) || p.en.test(t));
  return found.length === 1 ? found[0]!.id : null;
}

/** Оператор — РЖД целиком, без указания дороги: «ОАО «РЖД»», «РЖД», «Российские железные дороги». */
export function isRzdGeneric(text: string | undefined): boolean {
  if (!text) return false;
  const t = normalizeText(text);
  return /(?<![а-я])ржд(?![а-я])|российские железные дороги|russian railways/.test(t);
}

const ROAD_BY_QID = new Map<string, RoadId>(ROADS.map((r) => [r.wikidata, r.id]));

/** Дорога по QID элемента Wikidata, если это одна из 16. */
export function roadByQid(qid: string): RoadId | null {
  return ROAD_BY_QID.get(qid) ?? null;
}

export function isRoadId(value: string): value is RoadId {
  return (ROAD_IDS as readonly string[]).includes(value);
}
