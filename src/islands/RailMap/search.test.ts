import { describe, expect, it } from 'vitest';
import type { Point } from './model';
import { buildIndex, fold, search, translit } from './search';

const pt = (name: string, halt = false, esr: string | null = null): Point => ({ name, lon: 0, lat: 0, group: 0, esr, halt });
const points = [
  pt('Ростов-Берег', true),
  pt('Садки-Ростовские'),
  pt('Ростов-Главный', false, '510204'),
  pt('Ростов'),
  pt('Орёл', false, '208001'),
  pt('Москва-Пассажирская-Курская', false, '191551'),
];
const index = buildIndex(points);
const names = (q: string, limit?: number) => search(index, q, limit).top.map((i) => points[i]!.name);

describe('station search', () => {
  it('transliterates Russian names for Latin readers', () => {
    expect(translit('Ростов-Главный')).toBe('Rostov-Glavnyy');
    expect(translit('Щучье Озеро')).toBe('Shchuche Ozero');
    expect(translit('Орёл')).toBe('Orel');
  });

  it('folds case, ё and punctuation', () => {
    expect(fold('  Орёл-Сортировочный ')).toBe('орел сортировочный');
  });

  it('ranks exact names, then prefixes, then word starts, stations before halts', () => {
    expect(names('ростов')).toEqual(['Ростов', 'Ростов-Главный', 'Ростов-Берег', 'Садки-Ростовские']);
  });

  it('finds Cyrillic names by Latin queries and ignores ё', () => {
    expect(names('rostov gl')).toEqual(['Ростов-Главный']);
    expect(names('орел')).toEqual(['Орёл']);
    expect(names('kursk')).toEqual(['Москва-Пассажирская-Курская']);
  });

  it('finds stations by ESR code', () => {
    expect(names('5102')).toEqual(['Ростов-Главный']);
  });

  it('reports the total beyond the shown limit and nothing for an empty query', () => {
    expect(search(index, 'ростов', 2)).toEqual({ top: [3, 2], total: 4 });
    expect(search(index, '  ')).toEqual({ top: [], total: 0 });
  });
});
