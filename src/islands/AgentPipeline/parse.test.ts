// Эталоны — вывод оригинальных функций team-ai-bolid (deep_research.py, proposal_evaluator.py) на тех же входах.
import { describe, expect, it } from 'vitest';
import { LABELS, compactText, extractDecision, extractExecutiveSummary, extractScore, extractVerdict } from './parse';

const digits = Array.from({ length: 5000 }, (_, i) => String(i % 10)).join('');

describe('compactText', () => {
  it('trims and keeps short text', () => {
    expect(compactText('  short text \n')).toBe('short text');
  });

  it('keeps 70 % head and the tail, as compact_text does', () => {
    const out = compactText(digits, 1800);
    expect(out).toHaveLength(1789);
    expect(out.slice(1255, 1300)).toBe('56789\n\n...[TRUNCATED]...\n\n2345678901234567890');
  });

  it('reproduces the negative-tail slice for tiny limits', () => {
    expect(compactText(digits.slice(0, 150), 100)).toBe(
      '0123456789012345678901234567890123456789012345678901234567890123456789\n\n...[TRUNCATED]...\n\n' + digits.slice(2, 150),
    );
  });
});

describe('extractScore', () => {
  const cases: [string, keyof typeof LABELS, number | null][] = [
    ['Confidence: 78/100', 'confidence', 78],
    ['confidence score: 64', 'confidence', 64],
    ['Уверенность: 55,5 / 100', 'confidence', 55.5],
    ['Confidence： 120', 'confidence', 100],
    ['no score here', 'confidence', null],
    ['', 'confidence', null],
    // Первое вхождение метки, а не «итоговое»: так же ошибается и оригинал
    ['- Technical feasibility: 80/100\n- Overall feasibility: 72/100', 'feasibility', 80],
    // Порядок меток главнее позиции в тексте
    ['ИТОГОВАЯ ОЦЕНКА: 40\nFEASIBILITY: 90', 'feasibility', 90],
    ['Итоговая feasibility: 61/100', 'feasibility', 61],
    ['## Quality: 81/100\nquality: 50', 'quality', 81],
    ['## Quality Gates\n- passed: 4', 'quality', null],
  ];
  it.each(cases)('%j with %s labels → %s', (text, labels, expected) => {
    expect(extractScore(text, LABELS[labels])).toBe(expected);
  });
});

describe('extractDecision', () => {
  const cases: [string, string][] = [
    ['', 'UNKNOWN'],
    ['Recommendation: GO', 'GO'],
    ['GO WITH CONDITIONS: hire a data engineer first', 'GO WITH CONDITIONS'],
    ['This plan is no good', 'NO-GO'],
    ['The team can go live in May', 'GO'],
    ['Needs revision before the start', 'NEEDS REVISION'],
    ['ALGORITHM', 'UNKNOWN'],
    ['GO с условиями', 'GO WITH CONDITIONS'],
    ['GOД', 'UNKNOWN'],
    ['NO-GO', 'NO-GO'],
    ['no go', 'NO-GO'],
  ];
  it.each(cases)('%j → %s', (text, expected) => {
    expect(extractDecision(text)).toBe(expected);
  });
});

describe('extractExecutiveSummary', () => {
  const cases: [string, string][] = [
    ['# Deep Research Report: X\n\n## Executive Summary\nLine one.\nLine two.\n\n## 1. Overview\nbody', 'Line one.\nLine two.'],
    ['# Executive Summary\nOnly this', 'Only this'],
    ['No heading at all', 'No heading at all'],
    ['## Executive Summary\nTail text', 'Tail text'],
  ];
  it.each(cases)('%j', (text, expected) => {
    expect(extractExecutiveSummary(text)).toBe(expected);
  });
});

describe('extractVerdict', () => {
  const cases: [string, string][] = [
    ['Verdict: APPROVE', 'APPROVE'],
    ['Approve the project, there is no reason to reject it.', 'REJECT'],
    ['Рекомендую утвердить', 'APPROVE'],
    ['Отказоустойчивость высокая, утвердить', 'REJECT'],
    ['Verdict: UNDECIDED', 'UNDECIDED'],
    ['', 'UNDECIDED'],
  ];
  it.each(cases)('%j → %s', (text, expected) => {
    expect(extractVerdict(text)).toBe(expected);
  });
});
