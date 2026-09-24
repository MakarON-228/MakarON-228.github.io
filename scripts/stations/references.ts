// Станции-эталоны — управления 16 дорог (SPEC.md §7.4). В OSM часть из них названа иначе, чем в SPEC.

import type { Kind } from './normalize.ts';
import type { RoadId } from './roads.ts';

export interface Reference {
  /** Как в SPEC.md. */
  spec: string;
  /** Точное имя узла `railway=station` в OSM. */
  osm: string;
  road: RoadId;
}

export const REFERENCES: readonly Reference[] = [
  { spec: 'Санкт-Петербург-Главный', osm: 'Санкт-Петербург-Главный', road: 'oktyabrskaya' },
  { spec: 'Калининград-Пассажирский', osm: 'Калининград-Пассажирский', road: 'kaliningrad' },
  { spec: 'Москва-Курская', osm: 'Москва-Пассажирская-Курская', road: 'moscow' },
  { spec: 'Нижний Новгород-Московский', osm: 'Нижний Новгород-Московский', road: 'gorky' },
  { spec: 'Ярославль-Главный', osm: 'Ярославль-Главный', road: 'northern' },
  { spec: 'Ростов-Главный', osm: 'Ростов-Главный', road: 'north-caucasus' },
  { spec: 'Воронеж-1', osm: 'Воронеж 1', road: 'south-eastern' },
  { spec: 'Саратов-1', osm: 'Саратов I-Пассажирский', road: 'privolzhskaya' },
  { spec: 'Самара', osm: 'Самара', road: 'kuybyshev' },
  { spec: 'Екатеринбург-Пассажирский', osm: 'Екатеринбург-Пассажирский', road: 'sverdlovsk' },
  { spec: 'Челябинск-Главный', osm: 'Челябинск-Главный', road: 'south-urals' },
  { spec: 'Новосибирск-Главный', osm: 'Новосибирск-Главный', road: 'west-siberian' },
  { spec: 'Красноярск-Пассажирский', osm: 'Красноярск', road: 'krasnoyarsk' },
  { spec: 'Иркутск-Пассажирский', osm: 'Иркутск-Пассажирский', road: 'east-siberian' },
  { spec: 'Чита-2', osm: 'Чита II', road: 'trans-baikal' },
  { spec: 'Хабаровск-1', osm: 'Хабаровск I', road: 'far-eastern' },
];

export interface ReferenceResult extends Reference {
  /** Дорога в данных; `missing` — станции нет, `ambiguous` — таких станций несколько. */
  got: string;
  ok: boolean;
}

/** Сверка эталонов с любым набором записей, где у станции есть имя, тип и группа. */
export function checkReferences(rows: readonly { name: string; kind: Kind; group: string }[]): ReferenceResult[] {
  return REFERENCES.map((ref) => {
    const found = rows.filter((r) => r.kind === 'station' && r.name === ref.osm);
    const got = found.length === 0 ? 'missing' : found.length > 1 ? 'ambiguous' : found[0]!.group;
    return { ...ref, got, ok: got === ref.road };
  });
}
