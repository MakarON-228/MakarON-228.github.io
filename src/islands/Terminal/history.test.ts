import { describe, expect, it } from 'vitest';
import { History } from './history';

describe('History', () => {
  it('walks back and forth and returns the unfinished line at the end', () => {
    const h = new History();
    h.push('help');
    h.push('ls');
    expect(h.prev('cat pr')).toBe('ls');
    expect(h.prev('ls')).toBe('help');
    expect(h.prev('help')).toBeNull();
    expect(h.next()).toBe('ls');
    expect(h.next()).toBe('cat pr');
    expect(h.next()).toBeNull();
  });

  it('skips empty commands and repeats in a row', () => {
    const h = new History();
    h.push('ls');
    h.push('  ');
    h.push('ls ');
    h.push('help');
    h.push('ls');
    expect([h.prev(''), h.prev(''), h.prev(''), h.prev('')]).toEqual(['ls', 'help', 'ls', null]);
  });

  it('starts from the newest command after each push', () => {
    const h = new History();
    h.push('help');
    h.push('ls');
    h.prev('');
    h.prev('');
    h.push('whoami');
    expect(h.prev('')).toBe('whoami');
  });

  it('has nothing to show when empty', () => {
    const h = new History();
    expect(h.prev('x')).toBeNull();
    expect(h.next()).toBeNull();
  });
});
