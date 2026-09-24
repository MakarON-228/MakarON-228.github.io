import { describe, expect, it } from 'vitest';
import type { StationsFile } from '../../../scripts/stations/format';
import { FIELDS } from '../../../scripts/stations/format';
import type { GroupInfo } from './model';
import { boundsOf, decode, formatDate, sortGroups, visibleCount } from './model';

const file: StationsFile = {
  extracted: '2026-09-22T08:45:51Z',
  fields: FIELDS,
  operators: ['Крымская железная дорога'],
  rows: [
    ['Москва-Пассажирская-Курская', 37.66, 55.76, 1, '191551', 0],
    ['Лобня', 37.48, 56.01, 1, null, 1],
    ['Ростов-Главный', 39.69, 47.22, 0, '510204', 0],
    ['Симферополь', 34.11, 44.94, 2, '473012', 0, 0],
  ],
};
const groups: GroupInfo[] = [
  { id: 'north-caucasus', nameEn: 'North Caucasus Railway', stations: 403, halts: 495 },
  { id: 'moscow', nameEn: 'Moscow Railway', stations: 578, halts: 1053 },
  { id: 'other', nameEn: 'Other railways', stations: 335, halts: 44 },
  { id: 'unassigned', nameEn: 'Unassigned', stations: 84, halts: 18 },
  { id: 'gorky', nameEn: 'Gorky Railway', stations: 402, halts: 555 },
];

describe('rail map model', () => {
  it('decodes rows with kind and operator', () => {
    const points = decode(file);
    expect(points[1]).toEqual({ name: 'Лобня', lon: 37.48, lat: 56.01, group: 1, esr: null, halt: true });
    expect(points[3]!.operator).toBe('Крымская железная дорога');
  });

  it('frames the selected railways, with halts only when they are shown', () => {
    const points = decode(file);
    expect(boundsOf(points, new Set([1]), false)).toEqual({ west: 37.66, south: 55.76, east: 37.66, north: 55.76 });
    expect(boundsOf(points, new Set([1]), true)).toEqual({ west: 37.48, south: 55.76, east: 37.66, north: 56.01 });
    expect(boundsOf(points, new Set(), false)).toEqual({ west: 34.11, south: 44.94, east: 39.69, north: 55.76 });
    expect(boundsOf(points, new Set([4]), false)).toBeNull();
  });

  it('sorts railways by size or name and keeps other and unassigned last', () => {
    const name = (order: number[]) => order.map((i) => groups[i]!.id);
    expect(name(sortGroups(groups, 'size', false))).toEqual(['moscow', 'north-caucasus', 'gorky', 'other', 'unassigned']);
    expect(name(sortGroups(groups, 'size', true))).toEqual(['moscow', 'gorky', 'north-caucasus', 'other', 'unassigned']);
    expect(name(sortGroups(groups, 'name', false))).toEqual(['gorky', 'moscow', 'north-caucasus', 'other', 'unassigned']);
  });

  it('counts what the selection shows', () => {
    expect(visibleCount(groups, new Set([1]), false)).toEqual({ stations: 578, halts: 0 });
    expect(visibleCount(groups, new Set([0, 1]), true)).toEqual({ stations: 981, halts: 1548 });
    expect(visibleCount(groups, new Set(), false).stations).toBe(1802);
  });

  it('formats the extract date the same way everywhere', () => {
    expect(formatDate('2026-09-22T08:45:51Z')).toBe('22 Sep 2026');
  });
});
