import { describe, expect, it } from 'vitest';
import { parseRich, plainText } from './rich';

describe('parseRich', () => {
  it('splits strong and emphasis markup', () => {
    expect(parseRich('Built a **4,400-line** pipeline for *Academic Profile*.')).toEqual([
      { kind: 'text', text: 'Built a ' },
      { kind: 'strong', text: '4,400-line' },
      { kind: 'text', text: ' pipeline for ' },
      { kind: 'em', text: 'Academic Profile' },
      { kind: 'text', text: '.' },
    ]);
  });

  it('returns plain strings as a single text segment', () => {
    expect(parseRich('no markup')).toEqual([{ kind: 'text', text: 'no markup' }]);
  });

  it('handles markup at both ends', () => {
    expect(parseRich('**MSE 0.12**')).toEqual([{ kind: 'strong', text: 'MSE 0.12' }]);
  });
});

describe('plainText', () => {
  it('drops markup', () => {
    expect(plainText('**Sole backend engineer** — FastAPI')).toBe('Sole backend engineer — FastAPI');
  });
});
