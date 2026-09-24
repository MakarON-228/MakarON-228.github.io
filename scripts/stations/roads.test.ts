import { describe, expect, it } from 'vitest';
import { ROADS, isRzdGeneric, matchRoad, roadByQid } from './roads';

describe('railway roads', () => {
  it('lists the 16 RZD roads with unique ids and Wikidata items', () => {
    expect(ROADS).toHaveLength(16);
    expect(new Set(ROADS.map((r) => r.id)).size).toBe(16);
    expect(new Set(ROADS.map((r) => r.wikidata)).size).toBe(16);
  });

  it('recognises every road by its full Russian name', () => {
    for (const road of ROADS) expect(matchRoad(road.name), road.name).toBe(road.id);
  });

  it('recognises case forms, abbreviations of "railway" and English names', () => {
    expect(matchRoad('филиал ОАО «РЖД» — Северной железной дороги')).toBe('northern');
    expect(matchRoad('Московская ж. д.')).toBe('moscow');
    expect(matchRoad('Свердловская ЖД')).toBe('sverdlovsk');
    expect(matchRoad('ЗАПАДНО–СИБИРСКАЯ  железная дорога')).toBe('west-siberian');
    expect(matchRoad('Trans-Baikal Railway')).toBe('trans-baikal');
  });

  it('does not confuse roads whose names share a stem', () => {
    expect(matchRoad('Северо-Кавказская железная дорога')).toBe('north-caucasus');
    expect(matchRoad('Восточно-Сибирская железная дорога')).toBe('east-siberian');
    expect(matchRoad('Юго-Восточная железная дорога')).toBe('south-eastern');
    expect(matchRoad('Дальневосточная железная дорога')).toBe('far-eastern');
  });

  it('ignores non-RZD railways, abbreviations and ambiguous texts', () => {
    expect(matchRoad('Крымская железная дорога')).toBeNull();
    expect(matchRoad('ФГУП «КЖД»')).toBeNull();
    expect(matchRoad('Красноярский завод')).toBeNull();
    expect(matchRoad('Московская железная дорога; Октябрьская железная дорога')).toBeNull();
    expect(matchRoad(undefined)).toBeNull();
  });

  it('tells RZD as a whole from other operators', () => {
    expect(isRzdGeneric('ОАО «РЖД»')).toBe(true);
    expect(isRzdGeneric('РЖД')).toBe(true);
    expect(isRzdGeneric('Российские железные дороги')).toBe(true);
    expect(isRzdGeneric('Свердловская дирекция управления движением АО «РЖД»')).toBe(true);
    expect(isRzdGeneric('КТЖ')).toBe(false);
    expect(isRzdGeneric('Уральская Сталь')).toBe(false);
    expect(isRzdGeneric(undefined)).toBe(false);
  });

  it('maps Wikidata items of roads', () => {
    expect(roadByQid('Q1765011')).toBe('moscow');
    expect(roadByQid('Q660770')).toBeNull(); // РЖД целиком
  });
});
