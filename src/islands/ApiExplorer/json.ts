// Тело ответа как в Swagger UI: JSON с отступом 2 и подсветкой. Числа в полях float печатаются как их выдал бы
// Python (1.0, 5e-05), остальные — как есть. Разметка — токены, без {@html}.
import { pyFloat } from './csv';

/** k — ключ, s — строка, n — число, l — true/false/null, p — скобки, запятые и пробелы. */
export type Tok = { t: 'k' | 's' | 'n' | 'l' | 'p'; s: string };

/** Поля float в схемах ответов (RecommendationResponse, Analytics). */
const FLOAT_KEYS = new Set(['total_score', 'similarity_score', 'productivity_score', 'diversity_score', 'processing_time', 'index', 'average']);

export function jsonTokens(value: unknown): Tok[] {
  const out: Tok[] = [];
  const push = (t: Tok['t'], s: string) => {
    const last = out.at(-1);
    if (t === 'p' && last?.t === 'p') last.s += s;
    else out.push({ t, s });
  };
  const walk = (v: unknown, depth: number, key: string | null) => {
    const pad = '  '.repeat(depth + 1);
    const end = '  '.repeat(depth);
    if (v === null || typeof v === 'boolean') push('l', String(v));
    else if (typeof v === 'number') push('n', key !== null && FLOAT_KEYS.has(key) ? pyFloat(v) : String(v));
    else if (typeof v === 'string') push('s', JSON.stringify(v));
    else if (Array.isArray(v)) {
      if (!v.length) return push('p', '[]');
      push('p', '[\n');
      v.forEach((item, i) => {
        push('p', pad);
        walk(item, depth + 1, key);
        push('p', i < v.length - 1 ? ',\n' : '\n');
      });
      push('p', `${end}]`);
    } else if (typeof v === 'object') {
      const entries = Object.entries(v as Record<string, unknown>);
      if (!entries.length) return push('p', '{}');
      push('p', '{\n');
      entries.forEach(([k, item], i) => {
        push('p', pad);
        push('k', JSON.stringify(k));
        push('p', ': ');
        walk(item, depth + 1, k);
        push('p', i < entries.length - 1 ? ',\n' : '\n');
      });
      push('p', `${end}}`);
    }
  };
  walk(value, 0, null);
  return out;
}
