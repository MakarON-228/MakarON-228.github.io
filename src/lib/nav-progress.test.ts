import { describe, expect, it } from 'vitest';
import { activeIndex, arrivals, trainX } from './nav-progress';

const xs = [10, 110, 210];

describe('nav progress train', () => {
  it('waits at the start before the first section', () => {
    const arrive = arrivals([500, 1500, 2500], 5000);
    expect(trainX(0, arrive, xs, 0)).toBe(0);
    expect(activeIndex(0, arrive)).toBe(-1);
  });

  it('stands at a station when its section reaches the nav', () => {
    const arrive = arrivals([500, 1500, 2500], 5000);
    expect(trainX(500, arrive, xs, 0)).toBe(10);
    expect(trainX(1500, arrive, xs, 0)).toBe(110);
    expect(activeIndex(1500, arrive)).toBe(1);
  });

  it('moves linearly between stations', () => {
    const arrive = arrivals([500, 1500, 2500], 5000);
    expect(trainX(1000, arrive, xs, 0)).toBe(60);
    expect(trainX(250, arrive, xs, 0)).toBe(5);
  });

  it('reaches the terminus even when the last sections are too short to scroll to', () => {
    const arrive = arrivals([500, 1500, 2500], 1700);
    expect(arrive).toEqual([500, 1500, 1700]);
    expect(trainX(1700, arrive, xs, 0)).toBe(210);
    expect(activeIndex(1700, arrive)).toBe(2);

    const two = arrivals([500, 1800, 2500], 1700);
    expect(two).toEqual([500, 1100, 1700]);
    expect(trainX(1700, two, xs, 0)).toBe(210);
  });
});
