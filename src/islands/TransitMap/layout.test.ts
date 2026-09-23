import { describe, expect, it } from 'vitest';
import { entries, ui } from '../../data/resume';
import { buildMap, labelBox, overlaps, parseMonth, timeCoord, type MapLayout, type Orientation } from './layout';

const input = entries.map((e) => ({ id: e.id, line: e.line, name: e.station, date: e.date }));
const views: Orientation[] = ['horizontal', 'vertical'];
const maps = Object.fromEntries(views.map((o) => [o, buildMap(input, o, ui.map.hub)])) as Record<Orientation, MapLayout>;

describe('parseMonth', () => {
  it('counts months from January 2024', () => {
    expect(parseMonth('Jan 2024')).toBe(0);
    expect(parseMonth('Jul 2025')).toBe(18);
    expect(parseMonth('Apr 2026')).toBe(27);
  });

  it('rejects anything but "Mon YYYY"', () => {
    expect(() => parseMonth('2024 – 2029')).toThrow();
    expect(() => parseMonth('July 2025')).toThrow();
  });
});

describe.each(views)('%s map', (orientation) => {
  const map = maps[orientation];
  const time = (s: { x: number; y: number }) => (orientation === 'horizontal' ? s.x : s.y);

  it('has every dated entry exactly once, on its own line', () => {
    expect(map.stations.map((s) => s.id).sort()).toEqual(entries.map((e) => e.id).sort());
    for (const e of entries) expect(map.stations.find((s) => s.id === e.id)?.line).toBe(e.line);
  });

  it('puts each station in the month of its event (SPEC §4 order)', () => {
    expect(map.stations.map((s) => s.name)).toEqual([
      'SIBUR',
      'Young Scientists',
      'TMH Hackathon',
      'Score Editor',
      'Yandex',
      'TMH Internship',
    ]);
    for (const s of map.stations) expect(time(s)).toBe(timeCoord(parseMonth(s.date), orientation));
  });

  it('draws lines only at 0°, 45° and 90°', () => {
    for (const line of map.lines) {
      line.points.slice(1).forEach((p, i) => {
        const q = line.points[i]!;
        const angle = (Math.atan2(Math.abs(p.y - q.y), Math.abs(p.x - q.x)) * 180) / Math.PI;
        expect([0, 45, 90]).toContain(Math.round(angle * 1000) / 1000);
      });
    }
  });

  it('ends each line at its last station', () => {
    for (const line of map.lines) {
      const own = map.stations.filter((s) => s.line === line.line);
      const end = line.points[line.points.length - 1]!;
      const last = own[own.length - 1]!;
      expect([end.x, end.y]).toEqual([last.x, last.y]);
      for (const s of own) expect(orientation === 'horizontal' ? s.y : s.x).toBe(orientation === 'horizontal' ? end.y : end.x);
    }
  });

  it('keeps labels apart and inside the viewBox', () => {
    const labels = [...map.stations.map((s) => s.label), map.hub.label];
    const boxes = labels.map((l) => labelBox(l));
    boxes.forEach((a, i) => {
      expect(a.x0).toBeGreaterThanOrEqual(0);
      expect(a.y0).toBeGreaterThanOrEqual(0);
      expect(a.x1).toBeLessThanOrEqual(map.width);
      expect(a.y1).toBeLessThanOrEqual(map.height);
      boxes.slice(i + 1).forEach((b, j) => expect(overlaps(a, b), `${labels[i]!.text} × ${labels[i + 1 + j]!.text}`).toBe(false));
    });
  });
});

it('vertical map is the horizontal one turned: time runs down', () => {
  const byId = (m: MapLayout) => Object.fromEntries(m.stations.map((s) => [s.id, s]));
  const h = byId(maps.horizontal);
  const v = byId(maps.vertical);
  const ids = Object.keys(h).sort((a, b) => h[a]!.x - h[b]!.x);
  expect([...ids].sort((a, b) => v[a]!.y - v[b]!.y)).toEqual(ids);
});
