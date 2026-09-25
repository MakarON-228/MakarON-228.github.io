// Рекомендер команды — порт CollaborationRecommender (app/recommender.py) и профиля автора из ModelTrainer
// (train_model.py). Модель и формула оценки — работа команды; бэкенд Макара её только вызывает. Векторы — словарём
// обученного TF-IDF команды, KNN по косинусу перебором, как NearestNeighbors(metric='cosine', algorithm='brute').
import type { AuthorInterestRow } from '../../data/demo/academic-scientists';
import { WORD_RUN, dot, normalize, type Sparse, type Tfidf } from './tfidf';

export interface Recommendation {
  author_id: string;
  author_name: string;
  total_score: number;
  similarity_score: number;
  productivity_score: number;
  diversity_score: number;
  articles_count: number;
  interests_count: number;
  main_interest: string | null;
}

/** Профиль автора как ModelTrainer._create_author_profile: интересы (split('|') — в данных запятые, строка
 *  остаётся целой), ключевые слова, главный интерес — через пробел. */
export function authorProfile(a: AuthorInterestRow): string {
  const parts: string[] = [];
  if (a.interests_list !== null) parts.push(a.interests_list.split('|').map((s) => s.trim()).join(' '));
  if (a.keywords_list !== null) parts.push(...a.keywords_list.split('|').map((s) => s.trim()));
  if (a.main_interest !== null) parts.push(a.main_interest);
  return parts.join(' ');
}

const STOP = new Set(['research', 'study', 'analysis', 'method', 'results', 'conclusion']);

/** _create_target_profile: интересы плюс 10 самых частых слов публикаций (`\b[a-z]{4,}\b`, без шести стоп-слов). */
export function targetProfile(interests: readonly string[], publications: readonly string[] | null): string {
  const parts = [...interests];
  if (publications && publications.length) {
    const text = publications.join(' ').toLowerCase();
    // \b[a-z]{4,}\b в Python: целое «слово» \w+, состоящее только из латиницы, длиной от 4
    const words = (text.match(WORD_RUN) ?? []).filter((w) => /^[a-z]{4,}$/.test(w) && !STOP.has(w));
    const counts = new Map<string, number>();
    for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1);
    // Counter.most_common: по убыванию частоты, при равенстве — порядок первого появления (сортировка устойчива)
    const top = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 10);
    parts.push(...top.map(([w]) => w));
  }
  return parts.join(' ');
}

export class Recommender {
  readonly vectors: Sparse[];
  private readonly maxArticles: number;
  private readonly maxInterests: number;

  constructor(
    private readonly tfidf: Tfidf,
    readonly df: readonly AuthorInterestRow[],
  ) {
    this.vectors = df.map((a) => tfidf.transform(authorProfile(a)));
    this.maxArticles = Math.max(...df.map((a) => a.articles_count ?? 0));
    this.maxInterests = Math.max(...df.map((a) => a.interests_count ?? 0));
  }

  recommend(interests: readonly string[], publications: readonly string[] | null = null, topK = 10): Recommendation[] {
    const target = this.tfidf.transform(targetProfile(interests, publications));
    const nNeighbors = Math.min(topK * 10, this.df.length);

    // cosine_distances: 1 − cos на заново нормированных векторах, обрезка в [0, 2]; соседи по возрастанию расстояния
    const unit = (v: Sparse) => {
      const c = new Map(v);
      normalize(c);
      return c;
    };
    const t = unit(target);
    const neighbours = this.vectors
      .map((v, i) => ({ i, d: Math.min(Math.max(1 - dot(t, unit(v)), 0), 2) }))
      .sort((a, b) => a.d - b.d || a.i - b.i)
      .slice(0, nNeighbors);

    const out: Recommendation[] = [];
    for (const { i, d } of neighbours) {
      const similarity = 1 - d;
      if (similarity < 0.1) continue;
      const a = this.df[i]!;
      const productivity = this.maxArticles > 0 ? a.articles_count! / this.maxArticles : 0;
      const diversity = this.maxInterests > 0 ? a.interests_count! / this.maxInterests : 0;
      out.push({
        author_id: a.author_id,
        author_name: a.author_name ?? 'Unknown',
        total_score: similarity * 0.6 + productivity * 0.25 + diversity * 0.15,
        similarity_score: similarity,
        productivity_score: productivity,
        diversity_score: diversity,
        articles_count: a.articles_count ?? 0,
        interests_count: a.interests_count ?? 0,
        main_interest: a.main_interest,
      });
      // Отбор — первые top_k по сходству, и только потом сортировка по итоговой оценке, как в оригинале
      if (out.length >= topK) break;
    }
    return out.sort((a, b) => b.total_score - a.total_score).slice(0, topK);
  }
}
