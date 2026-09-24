// Перещёлкивание выделенных цифр по наведению мыши и тапу (SPEC.md §7.2).
// В покое, без JS и при reduced motion текст показывает настоящее значение.

import { flapDuration, flapFrame } from './flap';

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

export function initFlap(el: HTMLElement): void {
  const target = el.textContent ?? '';
  const total = flapDuration(target);
  if (total === 0) return;
  let running = false;

  const flap = () => {
    if (running || reduce.matches) return;
    running = true;
    const seed = Math.floor(Math.random() * 1e9);
    const start = performance.now();
    let shown = target;

    const tick = (now: number) => {
      const elapsed = now - start;
      const frame = elapsed < total ? flapFrame(target, elapsed, seed) : target;
      if (frame !== shown) {
        shown = frame;
        el.textContent = frame;
      }
      if (elapsed < total) requestAnimationFrame(tick);
      else running = false;
    };
    requestAnimationFrame(tick);
  };

  el.addEventListener('pointerenter', (e) => {
    if (e.pointerType === 'mouse') flap();
  });
  el.addEventListener('click', flap);
}
