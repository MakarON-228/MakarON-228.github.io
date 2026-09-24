// Разбор ответов агентов — порт функций платформы «AI Болид» строка в строку (team-ai-bolid):
// compact_text, extract_score, extract_decision, extract_executive_summary — src/deep_research.py;
// extract_verdict — src/proposal_evaluator.py. Причуды оригинала сохранены: REJECT проверяется раньше APPROVE,
// NO-GO — раньше GO, балл выше 100 обрезается до 100. Эталоны в тестах получены вызовом самих Python-функций.
// Отличия движков: длина строки в JS — в UTF-16, в Python — в кодовых точках (в текстах демо символов вне BMP нет);
// \b Python на str знает Unicode, поэтому границы слова здесь — явные просмотры по \p{L}\p{N}_.

/** Голова — 70 % лимита, хвост — остаток минус 32; между ними метка обрезки. */
export function compactText(text: string, maxChars = 4000): string {
  text = (text || '').trim();
  if (text.length <= maxChars) return text;
  const head = Math.trunc(maxChars * 0.7);
  const tail = maxChars - head - 32;
  return text.slice(0, head) + '\n\n...[TRUNCATED]...\n\n' + text.slice(-tail);
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Первое «метка: число» по порядку меток: сначала вида «N/100», потом просто «N». */
export function extractScore(text: string, labels: readonly string[]): number | null {
  if (!text) return null;
  const patterns: RegExp[] = [];
  for (const label of labels) {
    patterns.push(
      new RegExp(`${escape(label)}\\s*[:：]\\s*(\\d+(?:[.,]\\d+)?)\\s*/\\s*100`, 'i'),
      new RegExp(`${escape(label)}\\s*[:：]\\s*(\\d+(?:[.,]\\d+)?)`, 'i'),
    );
  }
  for (const pattern of patterns) {
    const m = pattern.exec(text);
    if (m) {
      const value = Number(m[1]!.replace(',', '.'));
      if (Number.isFinite(value)) return value > 100 ? 100 : value;
    }
  }
  return null;
}

export type Decision = 'GO' | 'NO-GO' | 'GO WITH CONDITIONS' | 'NEEDS REVISION' | 'UNKNOWN';

export function extractDecision(text: string): Decision {
  if (!text) return 'UNKNOWN';
  const upper = text.toUpperCase();
  if (upper.includes('NO-GO') || upper.includes('NO GO')) return 'NO-GO';
  if (
    upper.includes('GO WITH CONDITIONS') ||
    upper.includes('GO WITH CONDITION') ||
    upper.includes('GO С УСЛОВИЯМИ') ||
    upper.includes('GO WITH CONSTRAINTS')
  )
    return 'GO WITH CONDITIONS';
  if (upper.includes('NEEDS REVISION')) return 'NEEDS REVISION';
  // (?<!NO[-\s])\bGO\b
  if (/(?<!NO[-\s])(?<![\p{L}\p{N}_])GO(?![\p{L}\p{N}_])/u.test(upper)) return 'GO';
  return 'UNKNOWN';
}

// \Z Python — только конец строки; $ с флагом m в обоих движках — конец строки текста
const SUMMARY = [/^\s*##\s*Executive Summary\s*$([\s\S]*?)(?=^\s*##\s|(?![\s\S]))/im, /^\s*#\s*Executive Summary\s*$([\s\S]*?)(?=^\s*##\s|(?![\s\S]))/im];

export function extractExecutiveSummary(text: string): string {
  if (!text) return '';
  for (const pattern of SUMMARY) {
    const m = pattern.exec(text);
    if (m) return m[1]!.trim();
  }
  return compactText(text, 3000);
}

export type Verdict = 'APPROVE' | 'REJECT' | 'UNDECIDED';

export function extractVerdict(text: string): Verdict {
  const upper = (text || '').toUpperCase();
  if (upper.includes('REJECT') || upper.includes('ОТКЛОНИТ') || upper.includes('ОТКАЗ')) return 'REJECT';
  if (upper.includes('APPROVE') || upper.includes('УТВЕРДИТ') || upper.includes('УТВЕРЖД')) return 'APPROVE';
  return 'UNDECIDED';
}

/** Метки, по которым код ищет баллы (proposal_evaluator.py, deep_research.py). */
export const LABELS = {
  confidence: ['confidence', 'уверенность', 'confidence score', 'итоговая уверенность'],
  feasibility: ['ИТОГОВАЯ FEASIBILITY', 'ИТОГОВАЯ ОЦЕНКА FEASIBILITY', 'FEASIBILITY', 'ИТОГОВАЯ ОЦЕНКА'],
  quality: ['Оценка качества', 'Качество', 'Quality'],
  completeness: ['Оценка полноты', 'Полнота', 'Completeness'],
} as const;
