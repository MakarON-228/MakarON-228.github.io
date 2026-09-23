import { describe, expect, it } from 'vitest';
import { nextTheme, readStored, resolveTheme, writeStored } from './theme';

describe('resolveTheme', () => {
  it('prefers the stored choice over the system setting', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('falls back to the system setting for missing or invalid values', () => {
    expect(resolveTheme(null, true)).toBe('dark');
    expect(resolveTheme('sepia', false)).toBe('light');
  });
});

describe('nextTheme', () => {
  it('toggles', () => {
    expect(nextTheme('light')).toBe('dark');
    expect(nextTheme('dark')).toBe('light');
  });
});

describe('storage', () => {
  const throwing = {
    getItem: () => {
      throw new Error('blocked');
    },
    setItem: () => {
      throw new Error('blocked');
    },
  };

  it('survives a storage that throws', () => {
    expect(readStored(throwing)).toBeNull();
    expect(() => writeStored('dark', throwing)).not.toThrow();
  });

  it('round-trips a valid theme and ignores garbage', () => {
    const data = new Map<string, string>();
    const storage = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
    };
    writeStored('dark', storage);
    expect(readStored(storage)).toBe('dark');
    data.set('theme', 'neon');
    expect(readStored(storage)).toBeNull();
  });

  it('works without storage at all', () => {
    expect(readStored(undefined)).toBeNull();
  });
});
