import { describe, expect, it } from 'vitest';
import { TIMING, flapDuration, flapFrame } from './flap';

const kind = (ch: string) => (/\d/.test(ch) ? 'digit' : /[A-Z]/.test(ch) ? 'upper' : /[a-z]/.test(ch) ? 'lower' : ch);

describe('split-flap frame', () => {
  it('shows the real value at rest and after the flap', () => {
    expect(flapFrame('209,638', 0, 1)).not.toBe('209,638'); // первая ячейка стартует сразу
    expect(flapFrame('209,638', -1, 1)).toBe('209,638');
    expect(flapFrame('209,638', flapDuration(7), 1)).toBe('209,638');
    expect(flapFrame('wear records', flapDuration(12) + 500, 7)).toBe('wear records');
  });

  it('keeps length, separators and character class while flipping', () => {
    for (let t = 0; t < flapDuration(17); t += 20) {
      const frame = flapFrame('4,400 line ETL.', t, 3);
      expect(frame).toHaveLength('4,400 line ETL.'.length);
      Array.from(frame).forEach((ch, i) => expect(kind(ch)).toBe(kind('4,400 line ETL.'[i]!)));
    }
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
