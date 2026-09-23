// Перещёлкивание табло по наведению, тапу и кнопке. В покое и при reduced motion ячейки показывают значения.

import { flapDuration, flapFrame } from './flap';

const ROW_DELAY = 120; // мс между строками при «Flip the board»
const NBSP = ' ';

interface Row {
  el: HTMLElement;
  target: string;
  glyphs: HTMLElement[];
  running: boolean;
}

export function initBoard(root: HTMLElement): void {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const button = root.querySelector<HTMLButtonElement>('[data-flip]');

  const rows: Row[] = Array.from(root.querySelectorAll<HTMLElement>('.row')).map((el) => ({
    el,
    target: el.dataset['target'] ?? '',
    glyphs: Array.from(el.querySelectorAll<HTMLElement>('.glyph')),
    running: false,
  }));

  const flap = (row: Row, delay = 0) => {
    if (row.running || reduce.matches) return;
    row.running = true;
    const seed = Math.floor(Math.random() * 1e9);
    const total = flapDuration(row.target.length);
    const shown = row.glyphs.map((g) => g.textContent ?? '');
    const start = performance.now() + delay;

    const tick = (now: number) => {
      const elapsed = now - start;
      const frame = flapFrame(row.target, elapsed, seed);
      row.glyphs.forEach((glyph, i) => {
        const ch = frame[i] === ' ' ? NBSP : (frame[i] ?? '');
        if (shown[i] === ch) return;
        shown[i] = ch;
        glyph.textContent = ch;
        // Шторка: символ падает сверху, как лепесток табло
        glyph.animate([{ transform: 'rotateX(75deg)', opacity: 0.35 }, { transform: 'none', opacity: 1 }], {
          duration: 50,
          easing: 'ease-out',
        });
      });
      if (elapsed < total) requestAnimationFrame(tick);
      else row.running = false;
    };
    requestAnimationFrame(tick);
  };

  for (const row of rows) {
    row.el.addEventListener('pointerenter', (e) => {
      if (e.pointerType === 'mouse') flap(row);
    });
    row.el.addEventListener('click', () => flap(row));
  }

  if (button) {
    const sync = () => {
      button.hidden = reduce.matches;
    };
    sync();
    reduce.addEventListener('change', sync);
    button.addEventListener('click', () => rows.forEach((row, i) => flap(row, i * ROW_DELAY)));
  }
}
