// Картинка превью ссылки (1200×630, public/og.png) и иконка для iOS (180×180, public/apple-touch-icon.png).
// Шаблон — HTML на шрифтах и токенах сайта, светлая тема: имя и роль из resume.ts, портрет из hero и схема
// линий из той же раскладки, что hero-карта (без подписей — в превью они нечитаемы). Рендерит headless Chromium,
// результат коммитится. Запуск вручную после правок имени, роли, фото или палитры: `npm run og`;
// путь к Chromium — переменная CHROME (по умолчанию chromium).

import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { entries, header, ui } from '../src/data/resume.ts';
import { buildMap } from '../src/islands/TransitMap/layout.ts';

const CACHE = '.cache/og';
const chrome = process.env['CHROME'] ?? 'chromium';
const file = (path: string) => pathToFileURL(path).href;
const font = (pkg: string, name: string) => file(`node_modules/${pkg}/files/${name}`);

const fonts = `
  @font-face { font-family: 'Barlow Condensed'; font-weight: 800; src: url(${font('@fontsource/barlow-condensed', 'barlow-condensed-latin-800-normal.woff2')}) format('woff2'); }
  @font-face { font-family: 'Barlow Condensed'; font-weight: 700; src: url(${font('@fontsource/barlow-condensed', 'barlow-condensed-latin-700-normal.woff2')}) format('woff2'); }
  @font-face { font-family: 'Overpass Mono Variable'; font-weight: 100 900; src: url(${font('@fontsource-variable/overpass-mono', 'overpass-mono-latin-wght-normal.woff2')}) format('woff2'); }
`;
const tokens = readFileSync('src/styles/tokens.css', 'utf8');

/** Схема линий: пути, капсула Сириуса и станции из раскладки hero-карты. */
function scheme(): string {
  const map = buildMap(
    entries.map((e) => ({ id: e.id, line: e.line, name: e.station, date: e.date })),
    'horizontal',
    ui.map.hub,
  );
  const { hub } = map;
  const tracks = map.lines.map((l) => `<path class="track" d="${l.d}" style="--c: var(--line-${l.line})"/>`).join('');
  const stops = map.stations
    .map((s) => `<circle class="dot" cx="${s.x}" cy="${s.y}" r="6.5" style="--c: var(--line-${s.line})"/>`)
    .join('');
  const capsule = `<rect class="capsule" x="${hub.x}" y="${hub.y}" width="${hub.width}" height="${hub.height}" rx="${Math.min(hub.width, hub.height) / 2}"/>`;
  // Рамка рисунка: от капсулы до последней станции, с полями под толщину линий
  const xs = map.stations.map((s) => s.x);
  const ys = [...map.stations.map((s) => s.y), hub.y, hub.y + hub.height];
  const [x0, x1, y0, y1] = [hub.x - 8, Math.max(...xs) + 12, Math.min(...ys) - 12, Math.max(...ys) + 12];
  return `<svg class="map" viewBox="${x0} ${y0} ${x1 - x0} ${y1 - y0}">${tracks}${capsule}${stops}</svg>`;
}

const page = (body: string, css: string) => `<!doctype html>
<html data-theme="light"><head><meta charset="utf-8"><style>${fonts}${tokens}
  html, body { margin: 0; background: var(--paper); color: var(--ink); overflow: hidden; }
  ${css}
</style></head><body>${body}</body></html>`;

const og = page(
  `<main>
    <h1>${header.name}</h1>
    <p class="role">${header.role}</p>
    <p class="where">${[header.location, ...header.languages].join(' · ')}</p>
    <img class="photo" src="${file('src/assets/makar-portrait.jpg')}" alt="">
    ${scheme()}
  </main>`,
  `
  main { position: relative; box-sizing: border-box; width: 1200px; height: 630px; padding: 64px 72px; }
  h1 { margin: 0; font: 800 112px/0.92 var(--font-display); text-transform: uppercase; letter-spacing: -0.005em; }
  h1::after { content: ''; display: block; width: 96px; height: 8px; margin-top: 22px; background: var(--line-science); }
  .role { margin: 30px 0 0; font: 700 46px/1.1 var(--font-display); color: var(--line-science); }
  .where { position: absolute; left: 72px; bottom: 60px; margin: 0; font: 400 24px var(--font-mono); color: var(--muted); }
  .photo { position: absolute; top: 52px; right: 72px; box-sizing: border-box; width: 224px; height: 224px; padding: 5px;
    background: var(--surface); border: 7px solid var(--line-science); border-radius: 50%; object-fit: cover; }
  .map { position: absolute; right: 64px; bottom: 44px; width: 540px; }
  .track { fill: none; stroke: var(--c); stroke-width: 6; stroke-linecap: round; stroke-linejoin: round; }
  .dot { fill: var(--surface); stroke: var(--c); stroke-width: 4; }
  .capsule { fill: var(--surface); stroke: var(--ink); stroke-width: 4; }
  `,
);

// Та же станция, что в favicon.svg, на непрозрачном фоне: iOS сам скругляет углы
const icon = page(
  `<svg viewBox="0 0 32 32" width="180" height="180"><circle cx="16" cy="16" r="9" stroke-width="5.5"/></svg>`,
  `svg { display: block; } circle { fill: var(--surface); stroke: var(--line-science); }`,
);

function render(name: string, html: string, width: number, height: number): Buffer {
  const src = `${CACHE}/${name}.html`;
  const shot = `${CACHE}/${name}.png`;
  writeFileSync(src, html);
  const run = spawnSync(chrome, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    '--force-color-profile=srgb',
    `--user-data-dir=${CACHE}/profile`,
    `--window-size=${width},${height}`,
    '--virtual-time-budget=5000',
    `--screenshot=${shot}`,
    file(src),
  ]);
  if (run.status !== 0) {
    console.error(run.stderr?.toString() || run.error);
    process.exit(1);
  }
  return readFileSync(shot);
}

mkdirSync(CACHE, { recursive: true });
for (const [name, html, width, height] of [
  ['og', og, 1200, 630],
  ['apple-touch-icon', icon, 180, 180],
] as const) {
  const png = await sharp(render(name, html, width, height))
    .resize(width, height, { fit: 'cover', position: 'left top' })
    .png({ compressionLevel: 9 })
    .toBuffer();
  writeFileSync(`public/${name}.png`, png);
  console.log(`public/${name}.png: ${width}×${height}, ${(png.length / 1024).toFixed(1)} KB`);
}
