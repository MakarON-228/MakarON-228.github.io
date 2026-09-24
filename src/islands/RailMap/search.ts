// Поиск станции по названию (SPEC.md §7.4): кириллица, латиница через транслитерацию, код ЕСР.

import type { Point } from './model';

const LATIN: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l',
  м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh',
  щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

/** Транслитерация в духе BGN/PCGN, упрощённая: «Ростов-Главный» → «Rostov-Glavnyy». Регистр сохраняется. */
export function translit(text: string): string {
  let out = '';
  for (const ch of text) {
    const lower = ch.toLowerCase();
    const lat = LATIN[lower];
    if (lat === undefined) out += ch;
    else out += ch !== lower && lat ? lat[0]!.toUpperCase() + lat.slice(1) : lat;
  }
  return out;
}

/** Для сравнения: нижний регистр, ё → е, пунктуация и дефисы → пробел. */
export function fold(text: string): string {
  return text
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export interface SearchIndex {
  cyr: string[];
  lat: string[];
  points: readonly Point[];
}

export function buildIndex(points: readonly Point[]): SearchIndex {
  return { cyr: points.map((p) => fold(p.name)), lat: points.map((p) => fold(translit(p.name))), points };
}

/** 0 — точное совпадение, 1 — начало названия, 2 — начало слова, 3 — где-то внутри; −1 — нет. */
function rank(name: string, q: string): number {
  if (name === q) return 0;
  if (name.startsWith(q)) return 1;
  if (name.includes(` ${q}`)) return 2;
  return name.includes(q) ? 3 : -1;
}

export interface SearchResult {
  /** Индексы лучших точек, не больше `limit`. */
  top: number[];
  /** Сколько точек подошло всего. */
  total: number;
}

/**
 * Подходящие точки, лучшие первыми: по качеству совпадения, станции раньше платформ, короткие раньше.
 * Запрос кириллицей ищется по названиям, латиницей — по транслитерации, из цифр — по коду ЕСР.
 */
export function search(index: SearchIndex, query: string, limit = 8): SearchResult {
  const q = fold(query);
  if (!q) return { top: [], total: 0 };
  const digits = /^\d{3,6}$/.test(q);
  const names = /[а-я]/.test(q) ? index.cyr : index.lat;
  const found: { i: number; r: number }[] = [];
  index.points.forEach((p, i) => {
    const r = digits ? (p.esr?.startsWith(q) ? (p.esr === q ? 0 : 1) : -1) : rank(names[i]!, q);
    if (r >= 0) found.push({ i, r });
  });
  const pts = index.points;
  found.sort(
    (a, b) =>
      a.r - b.r ||
      Number(pts[a.i]!.halt) - Number(pts[b.i]!.halt) ||
      pts[a.i]!.name.length - pts[b.i]!.name.length ||
      pts[a.i]!.name.localeCompare(pts[b.i]!.name, 'ru'),
  );
  return { top: found.slice(0, limit).map((f) => f.i), total: found.length };
}
