// Веб-Меркатор, как у MapLibre: статичная заглушка и начальный вид карты совпадают кадр в кадр.

import type { Bounds } from './model';

/** Начальный вид: вся сеть и силуэт страны — от Калининграда до Чукотки, от Кавказа до Таймыра. */
export const VIEW: Bounds = { west: 19, south: 41, east: 180, north: 77.8 };

/** Рамка подложки (scripts/build-land.ts): вид с запасом и Арктика до Земли Франца-Иосифа. */
export const LAND_BOUNDS: Bounds = { west: 15, south: 35, east: 180, north: 82 };

const RAD = Math.PI / 180;

export function mercatorY(lat: number): number {
  return Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2));
}

export interface Frame {
  width: number;
  height: number;
  /** Долгота/широта → пиксели кадра; y растёт вниз. */
  project(lon: number, lat: number): [number, number];
}

/** Кадр заданной ширины, в который рамка `view` вписана целиком без полей. */
export function frame(view: Bounds, width: number): Frame {
  const k = width / ((view.east - view.west) * RAD);
  const top = mercatorY(view.north);
  const height = (top - mercatorY(view.south)) * k;
  return {
    width,
    height,
    project: (lon, lat) => [(lon - view.west) * RAD * k, (top - mercatorY(lat)) * k],
  };
}
