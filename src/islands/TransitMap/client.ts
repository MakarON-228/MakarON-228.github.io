// Оживление карты линий: поезда и подсказки. Разметка и начальное положение поездов — из сборки.

import { schedule, trainAt, type Schedule } from './trains';

const SVG_NS = 'http://www.w3.org/2000/svg';
const SPEED = 55; // единиц viewBox в секунду
const DWELL = 1.4; // стоянка, секунды
const SAMPLE = 1; // шаг таблицы точек пути
const TRAIL = [
  { gap: 4, r: 2.6, opacity: 0.55 },
  { gap: 8, r: 2.2, opacity: 0.4 },
  { gap: 12, r: 1.8, opacity: 0.28 },
  { gap: 16, r: 1.4, opacity: 0.18 },
  { gap: 20, r: 1.1, opacity: 0.1 },
];

interface Train {
  origin: number;
  head: SVGCircleElement;
  trail: SVGCircleElement[];
}

interface Track {
  lut: Float32Array;
  length: number;
  plan: Schedule;
  trains: Train[];
}

/** Точки пути через getPointAtLength — один раз; дальше кадры только читают таблицу. */
function sample(path: SVGPathElement): Float32Array {
  const total = path.getTotalLength();
  const n = Math.ceil(total / SAMPLE) + 1;
  const lut = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const p = path.getPointAtLength(Math.min(total, i * SAMPLE));
    lut[i * 2] = p.x;
    lut[i * 2 + 1] = p.y;
  }
  return lut;
}

function pointAt(lut: Float32Array, s: number): [number, number] {
  const n = lut.length / 2;
  const f = Math.min(n - 1, Math.max(0, s / SAMPLE));
  const i = Math.floor(f);
  const j = Math.min(n - 1, i + 1);
  const k = f - i;
  return [lut[i * 2]! + (lut[j * 2]! - lut[i * 2]!) * k, lut[i * 2 + 1]! + (lut[j * 2 + 1]! - lut[i * 2 + 1]!) * k];
}

/** Ближайшая к точке позиция вдоль пути. */
function nearest(lut: Float32Array, x: number, y: number): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < lut.length / 2; i++) {
    const d = (lut[i * 2]! - x) ** 2 + (lut[i * 2 + 1]! - y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best * SAMPLE;
}

function buildTracks(svg: SVGSVGElement): Track[] {
  const group = svg.querySelector('.trains');
  return Array.from(svg.querySelectorAll<SVGPathElement>('.track')).map((path) => {
    const line = path.dataset['line'] ?? '';
    const lut = sample(path);
    const heads = Array.from(svg.querySelectorAll<SVGCircleElement>(`.train[data-line="${line}"]`));
    const stops = heads.map((h) => nearest(lut, h.cx.baseVal.value, h.cy.baseVal.value));
    const length = Math.max(...stops);
    const trains = heads.map((head, i) => {
      head.dataset['x'] = String(head.cx.baseVal.value);
      head.dataset['y'] = String(head.cy.baseVal.value);
      const trail = TRAIL.map((t) => {
        const c = document.createElementNS(SVG_NS, 'circle');
        c.classList.add('trail');
        c.dataset['line'] = line;
        c.setAttribute('r', String(t.r));
        c.setAttribute('opacity', String(t.opacity));
        c.setAttribute('cx', String(head.cx.baseVal.value));
        c.setAttribute('cy', String(head.cy.baseVal.value));
        group?.insertBefore(c, head);
        return c;
      });
      return { origin: stops[i]!, head, trail };
    });
    return { lut, length, plan: schedule({ length, stops, speed: SPEED, dwell: DWELL }), trains };
  });
}

function draw(tracks: readonly Track[], clock: number): void {
  for (const track of tracks) {
    for (const train of track.trains) {
      const { s, dir, pace } = trainAt(track.plan, train.origin, clock);
      const [x, y] = pointAt(track.lut, s);
      train.head.setAttribute('cx', x.toFixed(2));
      train.head.setAttribute('cy', y.toFixed(2));
      train.trail.forEach((dot, k) => {
        const back = Math.min(track.length, Math.max(0, s - dir * TRAIL[k]!.gap * pace));
        const [tx, ty] = pointAt(track.lut, back);
        dot.setAttribute('cx', tx.toFixed(2));
        dot.setAttribute('cy', ty.toFixed(2));
      });
    }
  }
}

/** Вернуть поезда на станции и убрать шлейфы — состояние без анимации. */
function park(tracks: readonly Track[]): void {
  for (const train of tracks.flatMap((t) => t.trains)) {
    train.head.setAttribute('cx', train.head.dataset['x'] ?? '0');
    train.head.setAttribute('cy', train.head.dataset['y'] ?? '0');
    train.trail.forEach((dot) => dot.remove());
  }
}

function setupTooltip(root: HTMLElement): void {
  const tip = root.querySelector<HTMLElement>('.tip');
  if (!tip) return;
  const parts = {
    title: tip.querySelector<HTMLElement>('[data-tip="title"]'),
    date: tip.querySelector<HTMLElement>('[data-tip="date"]'),
    role: tip.querySelector<HTMLElement>('[data-tip="role"]'),
  };

  const show = (target: SVGAElement) => {
    const anchor = target.querySelector('.dot, .capsule') ?? target;
    for (const key of ['title', 'date', 'role'] as const) {
      const el = parts[key];
      if (!el) continue;
      el.textContent = target.dataset[`tip${key[0]!.toUpperCase()}${key.slice(1)}`] ?? '';
      el.hidden = el.textContent === '';
    }
    tip.hidden = false;
    const box = root.getBoundingClientRect();
    const r = anchor.getBoundingClientRect();
    const cx = r.left + r.width / 2 - box.left;
    const left = Math.min(Math.max(0, cx - tip.offsetWidth / 2), box.width - tip.offsetWidth);
    let top = r.top - box.top - tip.offsetHeight - 10;
    if (top < 0) top = r.bottom - box.top + 10;
    tip.style.transform = `translate(${left.toFixed(0)}px, ${top.toFixed(0)}px)`;
  };
  const hide = () => {
    tip.hidden = true;
  };

  root.querySelectorAll<SVGAElement>('a[data-tip-title]').forEach((a) => {
    a.addEventListener('pointerenter', () => show(a));
    a.addEventListener('pointerleave', hide);
    a.addEventListener('focus', () => show(a));
    a.addEventListener('blur', hide);
  });
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hide();
  });
}

export function initTransitMap(root: HTMLElement): void {
  setupTooltip(root);

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const wide = window.matchMedia('(min-width: 720px)');
  let tracks: Track[] = [];
  let visible = false;
  let raf = 0;
  let last = 0;
  let clock = 0;

  const frame = (now: number) => {
    // После паузы время не «догоняет»: шаг не больше 50 мс
    clock += Math.min(0.05, (now - last) / 1000);
    last = now;
    draw(tracks, clock);
    raf = requestAnimationFrame(frame);
  };

  const stop = () => {
    cancelAnimationFrame(raf);
    raf = 0;
  };

  const run = () => {
    if (raf) return;
    if (tracks.length === 0) {
      const svg = root.querySelector<SVGSVGElement>(wide.matches ? 'svg.horizontal' : 'svg.vertical');
      if (!svg) return;
      tracks = buildTracks(svg);
    }
    last = performance.now();
    raf = requestAnimationFrame(frame);
  };

  const update = () => (visible && !document.hidden && !reduce.matches ? run() : stop());

  const reset = () => {
    stop();
    park(tracks);
    tracks = [];
    clock = 0;
    update();
  };

  new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting ?? false;
    update();
  }).observe(root);
  document.addEventListener('visibilitychange', update);
  reduce.addEventListener('change', reset);
  wide.addEventListener('change', reset);
}
