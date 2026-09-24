// Карта MapLibre для RailMap (SPEC.md §7.4): своя подложка без тайлов, станции цветом дороги, выбор и подсветка.
// Только слои кругов и заливок — без текста на канвасе, поэтому не нужны ни шрифты, ни спрайты, ни внешние запросы.

import type { FeatureCollection } from 'geojson';
import type { ExpressionSpecification, FilterSpecification, GeoJSONSource, Map as MlMap, PointLike } from 'maplibre-gl';
import type { Bounds, Point } from './model';
import type { MapColors } from './palette';
import type { LandCollection } from './placeholder';
import { loadMapLibre } from './vendor';

export interface MapLabels {
  mapLabel: string;
  zoomIn: string;
  zoomOut: string;
  gestures: { windows: string; mac: string; mobile: string };
  attribution: string;
}

export interface MapOptions {
  container: HTMLElement;
  points: readonly Point[];
  land: LandCollection;
  colors: MapColors;
  /** Индекс группы `unassigned` — рисуется пустым кружком. */
  hollowGroup: number;
  view: Bounds;
  labels: MapLabels;
  reducedMotion: boolean;
  /** Наведение (`sticky = false`) или клик/тап (`sticky = true`) по станции; `null` — мимо станций. */
  onPick: (index: number | null, sticky: boolean) => void;
}

export interface MapHandle {
  setColors(colors: MapColors): void;
  setHalts(show: boolean): void;
  setSelection(groups: ReadonlySet<number>): void;
  fit(bounds: Bounds): void;
  /** Перелёт к станции и её подсветка. */
  focus(index: number): void;
  mark(index: number | null): void;
  destroy(): void;
}

const HALT: ExpressionSpecification = ['==', ['get', 'h'], 1];
const RADIUS: ExpressionSpecification = [
  'interpolate', ['linear'], ['zoom'],
  1, ['case', HALT, 1, 1.4],
  4, ['case', HALT, 1.6, 2.3],
  7, ['case', HALT, 2.6, 3.6],
  10, ['case', HALT, 4, 5.5],
];
const PICK_ZOOM = 8;
const HIT_PX = 8;

export async function createMap(o: MapOptions): Promise<MapHandle> {
  const maplibre = await loadMapLibre();
  const colorOf = (c: MapColors) =>
    [
      'match', ['get', 'g'],
      ...c.groups.flatMap((color, i) => [i, i === o.hollowGroup ? c.land : color]),
      c.muted,
    ] as unknown as ExpressionSpecification;
  const stations = {
    type: 'FeatureCollection' as const,
    features: o.points.map((p, i) => ({
      type: 'Feature' as const,
      id: i,
      geometry: { type: 'Point' as const, coordinates: [p.lon, p.lat] },
      properties: { g: p.group, h: p.halt ? 1 : 0 },
    })),
  };

  const map: MlMap = new maplibre.Map({
    container: o.container,
    style: {
      version: 8,
      sources: {
        land: { type: 'geojson', data: o.land as unknown as FeatureCollection },
        stations: { type: 'geojson', data: stations },
        pick: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
      },
      layers: [
        { id: 'water', type: 'background', paint: { 'background-color': o.colors.water } },
        { id: 'land', type: 'fill', source: 'land', filter: ['==', ['get', 'kind'], 'land'], paint: { 'fill-color': o.colors.land } },
        { id: 'lakes', type: 'fill', source: 'land', filter: ['==', ['get', 'kind'], 'lake'], paint: { 'fill-color': o.colors.water } },
        {
          id: 'stations',
          type: 'circle',
          source: 'stations',
          filter: ['==', ['get', 'h'], 0],
          paint: {
            'circle-radius': RADIUS,
            'circle-color': colorOf(o.colors),
            'circle-stroke-color': o.colors.muted,
            'circle-stroke-width': ['case', ['==', ['get', 'g'], o.hollowGroup], 1, 0],
          },
        },
        {
          id: 'pick',
          type: 'circle',
          source: 'pick',
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 6, 10, 10],
            'circle-color': 'rgba(0, 0, 0, 0)',
            'circle-stroke-color': o.colors.ink,
            'circle-stroke-width': 2.5,
          },
        },
      ],
    },
    bounds: [[o.view.west, o.view.south], [o.view.east, o.view.north]],
    fitBoundsOptions: { padding: 0 },
    renderWorldCopies: false,
    maxZoom: 11,
    pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
    cooperativeGestures: true,
    dragRotate: false,
    pitchWithRotate: false,
    touchPitch: false,
    fadeDuration: 0,
    attributionControl: { compact: false, customAttribution: o.labels.attribution },
    locale: {
      'Map.Title': o.labels.mapLabel,
      'NavigationControl.ZoomIn': o.labels.zoomIn,
      'NavigationControl.ZoomOut': o.labels.zoomOut,
      'CooperativeGesturesHandler.WindowsHelpText': o.labels.gestures.windows,
      'CooperativeGesturesHandler.MacHelpText': o.labels.gestures.mac,
      'CooperativeGesturesHandler.MobileHelpText': o.labels.gestures.mobile,
    },
  });
  map.touchZoomRotate.disableRotation();
  map.keyboard.disableRotation();
  map.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-left');

  await new Promise<void>((resolve, reject) => {
    map.once('load', () => resolve());
    map.once('error', (e) => reject(e.error));
  });
  // Дальше, чем весь вид, отдалять незачем.
  map.setMinZoom(map.getZoom() - 0.25);

  const nearestAt = (at: { x: number; y: number }): number | null => {
    const box: [PointLike, PointLike] = [[at.x - HIT_PX, at.y - HIT_PX], [at.x + HIT_PX, at.y + HIT_PX]];
    let best: number | null = null;
    let bestD = Infinity;
    for (const f of map.queryRenderedFeatures(box, { layers: ['stations'] })) {
      if (typeof f.id !== 'number') continue;
      const p = o.points[f.id]!;
      const q = map.project([p.lon, p.lat]);
      const d = (q.x - at.x) ** 2 + (q.y - at.y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = f.id;
      }
    }
    return best;
  };
  map.on('mousemove', (e) => {
    const i = nearestAt(e.point);
    map.getCanvas().style.cursor = i === null ? '' : 'pointer';
    o.onPick(i, false);
  });
  map.on('mouseout', () => o.onPick(null, false));
  map.on('click', (e) => o.onPick(nearestAt(e.point), true));

  const motion = (ms: number) => (o.reducedMotion ? 0 : ms);
  const pickSource = () => map.getSource<GeoJSONSource>('pick')!;

  const handle: MapHandle = {
    setColors(c) {
      map.setPaintProperty('water', 'background-color', c.water);
      map.setPaintProperty('land', 'fill-color', c.land);
      map.setPaintProperty('lakes', 'fill-color', c.water);
      map.setPaintProperty('stations', 'circle-color', colorOf(c));
      map.setPaintProperty('stations', 'circle-stroke-color', c.muted);
      map.setPaintProperty('pick', 'circle-stroke-color', c.ink);
    },
    setHalts(show) {
      map.setFilter('stations', show ? null : (['==', ['get', 'h'], 0] as FilterSpecification));
    },
    setSelection(groups) {
      const inSel: ExpressionSpecification = ['in', ['get', 'g'], ['literal', [...groups]]];
      map.setPaintProperty('stations', 'circle-opacity', groups.size ? ['case', inSel, 1, 0.12] : 1);
      map.setPaintProperty('stations', 'circle-stroke-opacity', groups.size ? ['case', inSel, 1, 0.12] : 1);
      map.setLayoutProperty('stations', 'circle-sort-key', groups.size ? ['case', inSel, 1, 0] : 0);
    },
    fit(b) {
      map.fitBounds([[b.west, b.south], [b.east, b.north]], { padding: 24, maxZoom: 9, duration: motion(700) });
    },
    focus(index) {
      const p = o.points[index]!;
      const zoom = Math.max(map.getZoom(), PICK_ZOOM);
      if (o.reducedMotion) map.jumpTo({ center: [p.lon, p.lat], zoom });
      else map.flyTo({ center: [p.lon, p.lat], zoom, duration: 1200, essential: false });
      handle.mark(index);
    },
    mark(index) {
      const p = index === null ? null : o.points[index]!;
      pickSource().setData({
        type: 'FeatureCollection',
        features: p ? [{ type: 'Feature', geometry: { type: 'Point', coordinates: [p.lon, p.lat] }, properties: {} }] : [],
      });
    },
    destroy() {
      map.remove();
    },
  };
  return handle;
}
