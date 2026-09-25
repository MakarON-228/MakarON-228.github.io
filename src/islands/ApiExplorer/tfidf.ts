// TfidfVectorizer.transform из scikit-learn с параметрами обученной модели команды (vectorizer.pkl): нижний регистр,
// токены `(?u)\b\w\w+\b`, английские стоп-слова убираются до склейки биграмм, n-граммы 1–2, сырые частоты × idf,
// L2-нормировка. Словарь, частоты документов и стоп-слова — src/data/demo/academic-tfidf.json.

export interface TfidfData {
  terms: readonly string[];
  df: readonly number[];
  n_docs: number;
  stop_words: readonly string[];
}

/** Разреженный вектор: индекс термина → вес. */
export type Sparse = Map<number, number>;

/** Слова как `\w+` в Python: буквы, цифры (в том числе не арабские) и подчёркивание. */
export const WORD_RUN = /[\p{L}\p{N}_]+/gu;

export class Tfidf {
  private readonly vocab: Map<string, number>;
  private readonly idf: Float64Array;
  private readonly stop: Set<string>;

  constructor(data: TfidfData) {
    this.vocab = new Map(data.terms.map((t, i) => [t, i]));
    // smooth_idf: ln((1 + n) / (1 + df)) + 1
    this.idf = Float64Array.from(data.df, (df) => Math.log((1 + data.n_docs) / (1 + df)) + 1);
    this.stop = new Set(data.stop_words);
  }

  transform(doc: string): Sparse {
    const tokens = (doc.toLowerCase().match(WORD_RUN) ?? []).filter((t) => [...t].length >= 2 && !this.stop.has(t));
    const grams = [...tokens];
    for (let i = 0; i + 1 < tokens.length; i++) grams.push(`${tokens[i]} ${tokens[i + 1]}`);

    const counts = new Map<number, number>();
    for (const g of grams) {
      const j = this.vocab.get(g);
      if (j !== undefined) counts.set(j, (counts.get(j) ?? 0) + 1);
    }
    const indices = [...counts.keys()].sort((a, b) => a - b);
    const vec: Sparse = new Map(indices.map((j) => [j, counts.get(j)! * this.idf[j]!]));
    normalize(vec);
    return vec;
  }
}

/** L2-нормировка на месте; нулевой вектор остаётся нулевым. */
export function normalize(vec: Sparse): void {
  let sq = 0;
  for (const v of vec.values()) sq += v * v;
  if (sq === 0) return;
  const norm = Math.sqrt(sq);
  for (const [j, v] of vec) vec.set(j, v / norm);
}

export function dot(a: Sparse, b: Sparse): number {
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let s = 0;
  for (const [j, v] of small) {
    const w = large.get(j);
    if (w !== undefined) s += v * w;
  }
  return s;
}
