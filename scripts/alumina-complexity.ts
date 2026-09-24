// Оценки сложности шагов для демо RouteFinder (SPEC.md §7.8). Модель CatBoost проекта в браузер не грузится:
// граф фиксирован, поэтому 17 оценок считаются один раз и коммитятся в src/data/demo/alumina-complexity.json.
// Запуск вручную: `npm run complexity -- <sibur-ml>/models/complexity_model.cbm`; Python с catboost и pandas —
// из переменной PYTHON (по умолчанию python3).

import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { reactions } from '../src/data/demo/alumina-reactions.ts';
import { FEATURES, featuresOf } from '../src/islands/RouteFinder/features.ts';

const OUT = 'src/data/demo/alumina-complexity.json';
const model = process.argv[2];
if (!model) {
  console.error('usage: npm run complexity -- <sibur-ml>/models/complexity_model.cbm');
  process.exit(1);
}

const rows = Object.fromEntries(reactions.map((r) => [r.id, featuresOf(r)]));
const py = spawnSync(process.env['PYTHON'] ?? 'python3', ['scripts/alumina-complexity.py', model], {
  input: JSON.stringify({ features: FEATURES, rows }),
  encoding: 'utf8',
});
if (py.status !== 0) {
  console.error(py.stderr || py.error);
  process.exit(1);
}
const scores = JSON.parse(py.stdout) as Record<string, number>;

const lines = reactions.map((r) => `    "${r.id}": { "x": ${JSON.stringify(rows[r.id])}, "score": ${scores[r.id]} }`);
writeFileSync(
  OUT,
  `{\n  "model": "sibur-ml models/complexity_model.cbm",\n  "features": ${JSON.stringify(FEATURES)},\n  "reactions": {\n${lines.join(',\n')}\n  }\n}\n`,
);
for (const r of reactions) console.log(`${String(r.id).padStart(2)}  ${rows[r.id]!.join(' ').padEnd(28)} ${scores[r.id]}`);
console.log(`→ ${OUT}`);
