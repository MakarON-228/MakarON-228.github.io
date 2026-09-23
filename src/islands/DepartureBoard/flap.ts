// Перекидные ячейки табло (SPEC.md §7.2). Чистые функции: кадр анимации по прошедшему времени.

export interface FlapTiming {
  /** Задержка старта соседней ячейки, мс — волна слева направо. */
  stagger: number;
  /** Время показа одного промежуточного символа, мс. */
  period: number;
  /** Сколько промежуточных символов до своего значения. */
  flips: number;
}

export const TIMING: FlapTiming = { stagger: 30, period: 55, flips: 5 };

const DIGITS = '0123456789';
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWER = UPPER.toLowerCase();

function alphabetOf(ch: string): string | null {
  if (DIGITS.includes(ch)) return DIGITS;
  if (UPPER.includes(ch)) return UPPER;
  if (LOWER.includes(ch)) return LOWER;
  return null; // пробелы, «,» и «.» не перещёлкиваются
}

/** Детерминированный «случайный» номер — одинаковый для одной ячейки и одного шага. */
function hash(seed: number, cell: number, step: number): number {
  let h = (seed * 374761393 + cell * 668265263 + step * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Длительность полного перещёлкивания строки длиной `length`, мс. */
export function flapDuration(length: number, timing: FlapTiming = TIMING): number {
  return Math.max(0, length - 1) * timing.stagger + timing.flips * timing.period;
}

/** Что показывают ячейки через `elapsed` мс после начала. До старта ячейки и после — настоящее значение. */
export function flapFrame(target: string, elapsed: number, seed: number, timing: FlapTiming = TIMING): string {
  return Array.from(target, (ch, i) => {
    const alphabet = alphabetOf(ch);
    const local = elapsed - i * timing.stagger;
    if (!alphabet || local < 0 || local >= timing.flips * timing.period) return ch;
    const step = Math.floor(local / timing.period);
    let pick = alphabet[hash(seed, i, step) % alphabet.length]!;
    // промежуточный символ не должен совпадать с настоящим, иначе ячейка «замирает»
    if (pick === ch) pick = alphabet[(alphabet.indexOf(ch) + 1) % alphabet.length]!;
    return pick;
  }).join('');
}
