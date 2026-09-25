import { describe, expect, it } from 'vitest';
import { complete } from './complete';

describe('complete', () => {
  it('completes a unique command with a trailing space', () => {
    expect(complete('he')).toEqual({ value: 'help ', options: ['help'] });
    expect(complete('wh')).toEqual({ value: 'whoami ', options: ['whoami'] });
  });

  it('lists every match and keeps the line when there is no longer common prefix', () => {
    expect(complete('c')).toEqual({ value: 'c', options: ['cat', 'cv', 'contact', 'clear'] });
  });

  it('extends to the common prefix of several matches', () => {
    expect(complete('cat tmh')).toEqual({ value: 'cat tmh-', options: ['tmh-internship', 'tmh-hackathon'] });
  });

  it('completes sections and entries for cat and open', () => {
    expect(complete('cat pro').value).toBe('cat projects ');
    expect(complete('open sc').value).toBe('open score-editor ');
    expect(complete('cat sibur sk').value).toBe('cat sibur skills ');
  });

  it('completes only the first name for open and theme', () => {
    expect(complete('open sibur sk')).toEqual({ value: 'open sibur sk', options: [] });
    expect(complete('theme d').value).toBe('theme dark ');
    expect(complete('theme dark l').options).toEqual([]);
  });

  it('keeps sudo out of the command list but completes hire makar after it', () => {
    expect(complete('s').options).toEqual([]);
    expect(complete('sudo ').value).toBe('sudo hire ');
    expect(complete('sudo hire ').value).toBe('sudo hire makar ');
    expect(complete('sudo rm ').options).toEqual([]);
  });

  it('ignores case and keeps what was typed before the word', () => {
    expect(complete('CAT  Edu').value).toBe('CAT  education ');
  });

  it('leaves the line alone when nothing matches', () => {
    expect(complete('play')).toEqual({ value: 'play', options: [] });
    expect(complete('help ')).toEqual({ value: 'help ', options: [] });
  });
});
