// Загрузка MapLibre по требованию — файлы отдаются как есть (см. maplibreVendor в astro.config.mjs).

import { version } from 'maplibre-gl/package.json';

export type MapLibre = typeof import('maplibre-gl');

const BASE = `${import.meta.env.BASE_URL}vendor/maplibre-gl-${version}/`;

let loading: Promise<MapLibre> | undefined;

/** Модуль и стили MapLibre; повторные вызовы отдают тот же промис. */
export function loadMapLibre(): Promise<MapLibre> {
  loading ??= Promise.all([
    import(/* @vite-ignore */ `${BASE}maplibre-gl.mjs`) as Promise<MapLibre>,
    loadStylesheet(`${BASE}maplibre-gl.css`),
  ]).then(([lib]) => lib);
  loading.catch(() => (loading = undefined));
  return loading;
}

function loadStylesheet(href: string): Promise<void> {
  if (document.querySelector(`link[href="${href}"]`)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.onload = () => resolve();
    link.onerror = () => reject(new Error(`stylesheet ${href} failed`));
    document.head.append(link);
  });
}
