// Цвета дорог (tokens.css): соседние дороги различимы в обеих темах — и при обычном зрении, и при протанопии
// и дейтеранопии (OKLab ΔE×100, симуляция Machado 2009; пороги — из методики dataviz: 15 обычное зрение,
// 8 цель и 6 минимум для дальтонизма при втором кодировании — у карты это подписи в панели и карточка).

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { RailwaysFile, StationsFile } from '../../../scripts/stations/format';
import { distanceKm } from '../../../scripts/stations/normalize';
import { decode } from './model';
import { roadToken } from './palette';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const css = read('../../styles/tokens.css');
const railways = JSON.parse(read('../../../public/data/railways.json')) as RailwaysFile;
const points = decode(JSON.parse(read('../../../public/data/stations.json')) as StationsFile);
const roads = railways.groups.slice(0, 16).map((g) => g.id);

function block(selector: string): Map<string, string> {
  const start = css.indexOf(`${selector} {`);
  const body = css.slice(start, css.indexOf('}', start));
  return new Map([...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1]!, m[2]!.trim()]));
}
const light = block(':root');
const darkMedia = block(":root:not([data-theme='light'])");
const darkToggle = block(":root[data-theme='dark']");
const theme = (overrides?: Map<string, string>) => new Map([...light, ...(overrides ?? [])]);

function resolve(vars: Map<string, string>, name: string): string {
  const value = vars.get(name);
  if (!value) throw new Error(`${name} is not defined`);
  const ref = value.match(/^var\((--[\w-]+)\)$/);
  return ref ? resolve(vars, ref[1]!) : value;
}

// ─── Цвет: sRGB → OKLab, симуляция дальтонизма ───────────────────────────────
const lin = (hex: string) => [1, 3, 5].map((i) => {
  const c = parseInt(hex.slice(i, i + 2), 16) / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}) as [number, number, number];
function oklab([r, g, b]: [number, number, number]) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
const MACHADO = {
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
};
const simulate = (rgb: [number, number, number], m: number[][]) =>
  m.map((row) => Math.min(1, Math.max(0, row[0]! * rgb[0] + row[1]! * rgb[1] + row[2]! * rgb[2]))) as [number, number, number];
const deltaE = (a: number[], b: number[]) => 100 * Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);
const luminance = (hex: string) => { const [r, g, b] = lin(hex); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a: string, b: string) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi! + 0.05) / (lo! + 0.05); };

/** Дороги-соседи по данным: есть станции двух дорог ближе 30 км друг к другу. */
function neighbours(): [string, string][] {
  const cells = new Map<string, typeof points>();
  for (const p of points) if (p.group < 16) cells.set(`${Math.floor(p.lat)}|${Math.floor(p.lon / 2)}`, [...(cells.get(`${Math.floor(p.lat)}|${Math.floor(p.lon / 2)}`) ?? []), p]);
  const pairs = new Set<string>();
  for (const p of points) {
    if (p.group >= 16) continue;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      for (const q of cells.get(`${Math.floor(p.lat) + dy}|${Math.floor(p.lon / 2) + dx}`) ?? []) {
        if (q.group > p.group && distanceKm(p, q) < 30) pairs.add(`${p.group}|${q.group}`);
      }
    }
  }
  return [...pairs].map((k) => k.split('|').map((i) => roads[Number(i)]!) as [string, string]);
}
const pairs = neighbours();

describe('railway colours', () => {
  it('defines every road in the light theme and the same dark overrides in both dark blocks', () => {
    for (const id of [...roads, 'other', 'unassigned']) expect(light.has(roadToken(id)), id).toBe(true);
    expect([...darkMedia]).toEqual([...darkToggle]);
  });

  it('finds the neighbouring railways in the data', () => {
    expect(pairs.length).toBeGreaterThan(15);
    expect(pairs).toContainEqual(['oktyabrskaya', 'moscow']);
  });

  for (const [name, vars] of [['light', theme()], ['dark', theme(darkToggle)]] as const) {
    const color = (id: string) => resolve(vars, roadToken(id));

    it(`keeps neighbouring railways apart in the ${name} theme`, () => {
      for (const [a, b] of pairs) {
        const [ca, cb] = [lin(color(a)), lin(color(b))];
        expect(deltaE(oklab(ca), oklab(cb)), `${a}/${b} normal`).toBeGreaterThanOrEqual(15);
        for (const [kind, m] of Object.entries(MACHADO)) {
          expect(deltaE(oklab(simulate(ca, m)), oklab(simulate(cb, m))), `${a}/${b} ${kind}`).toBeGreaterThanOrEqual(6);
        }
      }
    });

    it(`gives 16 distinct colours that stand out on land in the ${name} theme`, () => {
      const colors = roads.map(color);
      expect(new Set(colors).size).toBe(16);
      // 2.8 — янтарь Craft (2.82:1 на светлой суше); остальные ≥ 3:1. Значения дублирует панель с подписями.
      for (const id of roads) expect(contrast(color(id), resolve(vars, '--map-land')), id).toBeGreaterThanOrEqual(2.8);
    });
  }
});
