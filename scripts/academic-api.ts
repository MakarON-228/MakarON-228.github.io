// Словарь TF-IDF модели команды и эталоны для демо ApiExplorer (SPEC.md §7.7). Модель в браузер целиком не
// грузится: нужны только её словарь, частоты документов и стоп-слова — они коммитятся в
// src/data/demo/academic-tfidf.json. Эталоны — ответы настоящего бэкенда на сценарий из scenario.ts — пишутся в
// src/islands/ApiExplorer/golden.json и нужны только тестам.
// Запуск вручную: `npm run academic -- <academic-profile>/backend_academic`; Python с зависимостями бэкенда
// (requirements.txt клона) — из переменной PYTHON (по умолчанию .cache/academic-venv/bin/python). Окружение:
// `python -m venv --system-site-packages .cache/academic-venv` от Python с pandas и scikit-learn (Anaconda), затем
// pip install fastapi<0.116 "passlib[bcrypt]" "bcrypt<5" "python-jose[cryptography]" email-validator python-multipart httpx.

import { spawnSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { authorInterests, authors, userPublications, users } from '../src/data/demo/academic-scientists.ts';
import { EMAILS, TFIDF_SAMPLES, scenario } from '../src/islands/ApiExplorer/scenario.ts';

const MODEL_OUT = 'src/data/demo/academic-tfidf.json';
const GOLDEN_OUT = 'src/islands/ApiExplorer/golden.json';
/** Число авторов, на которых команда обучала TF-IDF (строк в authors_data.pkl). */
const N_DOCS = 194849;

const backend = process.argv[2];
if (!backend) {
  console.error('usage: npm run academic -- <academic-profile>/backend_academic');
  process.exit(1);
}
const venv = '.cache/academic-venv/bin/python';
const python = process.env['PYTHON'] ?? (existsSync(venv) ? venv : 'python3');

const py = spawnSync(python, ['scripts/academic-api.py', backend], {
  input: JSON.stringify({
    n_docs: N_DOCS,
    secret: 'golden-secret',
    jwt_exp: 1790000000,
    users,
    authors,
    author_interests: authorInterests,
    user_publications: userPublications,
    scenario,
    emails: EMAILS,
    tfidf: TFIDF_SAMPLES,
  }),
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});
if (py.status !== 0) {
  console.error(py.stderr || py.error);
  process.exit(1);
}
const { model, golden } = JSON.parse(py.stdout) as { model: Record<string, unknown>; golden: { responses: { status: number }[] } };

writeFileSync(
  MODEL_OUT,
  JSON.stringify({ source: 'academic-profile backend_academic/model/vectorizer.pkl', ...model }) + '\n',
);
writeFileSync(GOLDEN_OUT, JSON.stringify(golden, null, 1) + '\n');

const statuses = golden.responses.map((r, i) => `${scenario[i]!.method} ${scenario[i]!.path} → ${r.status}`);
console.log(statuses.join('\n'));
console.log(`→ ${MODEL_OUT}\n→ ${GOLDEN_OUT}`);
