import { describe, expect, it } from 'vitest';
import type { OsmElement, Station } from './normalize';
import { dedupe, normalize, toStation } from './normalize';

const node = (id: number, tags: Record<string, string>, lat = 55.75, lon = 37.6): OsmElement => ({ type: 'node', id, lat, lon, tags });

describe('station normalisation', () => {
  it('keeps a mainline station with its name, coordinates, ESR code and tags', () => {
    const s = toStation(
      node(1, {
        railway: 'station',
        name: '  Ростов-Главный ',
        'esr:user': '510204',
        operator: 'ОАО «РЖД»',
        'operator:branch': 'Северо-Кавказская железная дорога',
        wikidata: 'Q2028336',
      }, 47.217234, 39.688612),
    );
    expect(s).toEqual({
      osm: 'node/1',
      name: 'Ростов-Главный',
      lon: 39.6886,
      lat: 47.2172,
      kind: 'station',
      esr: '510204',
      operator: 'ОАО «РЖД»',
      branch: 'Северо-Кавказская железная дорога',
      wikidata: 'Q2028336',
    });
  });

  it('drops metro and other non-mainline stations', () => {
    for (const station of ['subway', 'light_rail', 'monorail', 'funicular', 'miniature']) {
      expect(toStation(node(1, { railway: 'station', station, name: 'X' }))).toBe('not-rail');
    }
    expect(toStation(node(1, { railway: 'tram_stop', name: 'X' }))).toBe('not-rail');
  });

  it('drops disused, abandoned and unnamed points', () => {
    expect(toStation(node(1, { railway: 'halt', disused: 'yes', name: 'X' }))).toBe('disused');
    expect(toStation(node(1, { railway: 'station', abandoned: 'yes', name: 'X' }))).toBe('disused');
    expect(toStation(node(1, { railway: 'station', name: '  ' }))).toBe('unnamed');
  });

  it('takes the centre of a station area and rejects malformed ESR codes', () => {
    const s = toStation({ type: 'way', id: 7, center: { lat: 56, lon: 38 }, tags: { railway: 'halt', name: 'Y', 'esr:user': '0318;12' } });
    expect(s).toMatchObject({ osm: 'way/7', kind: 'halt', lat: 56, lon: 38, esr: null });
  });

  it('keeps the node when the same station is also mapped as an area nearby', () => {
    const s = (osm: string, name: string, lat: number, kind: Station['kind'] = 'station'): Station => ({ osm, name, lat, lon: 37, kind, esr: null });
    const { kept, dropped } = dedupe([
      s('way/1', 'Лобня', 56.01),
      s('node/2', 'Лобня', 56.0),
      s('node/3', 'Лобня', 58.0), // одноимённая, но далеко — другая станция
      s('node/4', 'Лобня', 56.0, 'halt'), // платформа — другой объект
    ]);
    expect(kept.map((x) => x.osm)).toEqual(['node/2', 'node/3', 'node/4']);
    expect(dropped.map((x) => x.osm)).toEqual(['way/1']);
  });

  it('counts drops by reason', () => {
    const { stations, dropped } = normalize([
      node(1, { railway: 'station', name: 'A' }),
      node(2, { railway: 'station', station: 'subway', name: 'B' }),
      node(3, { railway: 'halt', disused: 'yes', name: 'C' }),
      node(4, { railway: 'station', name: 'A' }),
    ]);
    expect(stations).toHaveLength(1);
    expect(dropped).toEqual({ 'not-rail': 1, disused: 1, unnamed: 0, 'no-coords': 0, duplicate: 1 });
  });
});
