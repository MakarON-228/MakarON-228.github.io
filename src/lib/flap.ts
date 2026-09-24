// Перещёлкивание цифр в тексте записей (SPEC.md §7.2). Чистые функции: кадр анимации по прошедшему времени.
// Перещёлкиваются только цифры: буквы и разделители стоят, чтобы текст оставался читаемым.

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

/** Есть ли в строке что перещёлкивать. */
export function hasDigits(text: string): boolean {
  return /\d/.test(text);
}

/** Детерминированный «случайный» номер — одинаковый для одной ячейки и одного шага. */
function hash(seed: number, cell: number, step: number): number {
  let h = (seed * 374761393 + cell * 668265263 + step * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Длительность перещёлкивания строки, мс: до конца последней цифры. Без цифр — 0. */
export function flapDuration(target: string, timing: FlapTiming = TIMING): number {
  const chars = Array.from(target);
  let last = -1;
  chars.forEach((ch, i) => {
    if (DIGITS.includes(ch)) last = i;
  });
  return last < 0 ? 0 : last * timing.stagger + timing.flips * timing.period;
}

/** Что показывает строка через `elapsed` мс после начала. До старта ячейки и после — настоящее значение. */
export function flapFrame(target: string, elapsed: number, seed: number, timing: FlapTiming = TIMING): string {
  return Array.from(target, (ch, i) => {
    const local = elapsed - i * timing.stagger;
    if (!DIGITS.includes(ch) || local < 0 || local >= timing.flips * timing.period) return ch;
    const step = Math.floor(local / timing.period);
    let pick = DIGITS[hash(seed, i, step) % DIGITS.length]!;
    // промежуточная цифра не должна совпадать с настоящей, иначе ячейка «замирает»
    if (pick === ch) pick = DIGITS[(DIGITS.indexOf(ch) + 1) % DIGITS.length]!;
    return pick;
  }).join('');
}
