// @ts-check
import { cpSync, createReadStream, mkdirSync, readFileSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';

const maplibre = JSON.parse(readFileSync(new URL('./node_modules/maplibre-gl/package.json', import.meta.url), 'utf8')).version;

/**
 * MapLibre 6 ищет свой воркер рядом с собой через `import.meta.url`, и бандлер эту связь ломает.
 * Поэтому его готовые файлы отдаются как есть из `/vendor/maplibre-gl-<версия>/`, а остров RailMap
 * подгружает их динамическим импортом, только когда карта появляется на экране (SPEC.md §7.4).
 * Общий чанк качается один раз и для страницы, и для воркера.
 */
function maplibreVendor() {
  const dist = new URL('./node_modules/maplibre-gl/dist/', import.meta.url);
  const base = `/vendor/maplibre-gl-${maplibre}/`;
  const files = ['maplibre-gl.mjs', 'maplibre-gl-shared.mjs', 'maplibre-gl-worker.mjs', 'maplibre-gl.css'];
  const withMaps = [...files, ...files.filter((f) => f.endsWith('.mjs')).map((f) => `${f}.map`)];
  /** @type {import('astro').AstroIntegration} */
  const integration = {
    name: 'maplibre-vendor',
    hooks: {
      'astro:server:setup': ({ server }) => {
        server.middlewares.use((req, res, next) => {
          const file = req.url?.startsWith(base) ? req.url.slice(base.length).split('?')[0] : undefined;
          if (!file || !withMaps.includes(file)) return next();
          const type = file.endsWith('.css') ? 'text/css' : file.endsWith('.map') ? 'application/json' : 'text/javascript';
          res.setHeader('Content-Type', `${type}; charset=utf-8`);
          createReadStream(new URL(file, dist)).pipe(res);
        });
      },
      'astro:build:done': ({ dir }) => {
        const out = new URL(`.${base}`, dir);
        mkdirSync(out, { recursive: true });
        for (const file of withMaps) cpSync(new URL(file, dist), new URL(file, out));
      },
    },
  };
  return integration;
}

export default defineConfig({
  site: 'https://makaron-228.github.io',
  integrations: [svelte(), maplibreVendor()],
});
