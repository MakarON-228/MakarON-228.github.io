import { describe, expect, it } from 'vitest';
import { TIMING, flapDuration, flapFrame, hasDigits } from './flap';

const FIGURE = '407,669 wheel-wear records';
const shape = (s: string) => s.replace(/\d/g, '#');

describe('flap frame', () => {
  it('shows the real value at rest and after the flap', () => {
    expect(flapFrame('209,638', 0, 1)).not.toBe('209,638'); // первая ячейка стартует сразу
    expect(flapFrame('209,638', -1, 1)).toBe('209,638');
    expect(flapFrame('209,638', flapDuration('209,638'), 1)).toBe('209,638');
    expect(flapFrame(FIGURE, flapDuration(FIGURE) + 500, 7)).toBe(FIGURE);
  });

  it('flips digits only — letters, separators and length stay', () => {
    for (let t = 0; t < flapDuration(FIGURE); t += 20) {
      const frame = flapFrame(FIGURE, t, 3);
      expect(shape(frame)).toBe(shape(FIGURE));
    }
    expect(flapFrame('MSE 0.12', 70, 3).startsWith('MSE ')).toBe(true);
  });

  it('waves left to right', () => {
    const t = TIMING.stagger * 3 + 1;
    const frame = flapFrame('0000000', t, 5);
    expect(frame.slice(0, 4)).not.toBe('0000');
    expect(frame.slice(4)).toBe('000');
  });

  it('is deterministic for the same seed and time', () => {
    expect(flapFrame('0.12', 60, 42)).toBe(flapFrame('0.12', 60, 42));
  });
});

describe('flap duration', () => {
  it('ends with the last digit, not the trailing words', () => {
    expect(flapDuration(FIGURE)).toBe(6 * TIMING.stagger + TIMING.flips * TIMING.period);
    expect(flapDuration('MSE 0.12')).toBe(7 * TIMING.stagger + TIMING.flips * TIMING.period);
  });

  it('is zero for text without digits', () => {
    expect(flapDuration('Sole backend engineer')).toBe(0);
    expect(flapFrame('every', 30, 1)).toBe('every');
    expect(hasDigits('nine-agent')).toBe(false);
    expect(hasDigits('16 agents')).toBe(true);
  });
});
