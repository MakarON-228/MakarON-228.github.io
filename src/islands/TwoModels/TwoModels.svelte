<script lang="ts">
  // Остров TwoModels (SPEC.md §7.6): задумка на синтетике — у каждой из двух моделей своя область, где она ошибается,
  // и взвешенная сумма прогнозов держит весь диапазон. Ползунок меняет вес модели A, график MAE по децилям и MSE
  // пересчитываются сразу. Вертикальный курсор над графиком показывает значения всех трёх линий в дециле.
  import { ui } from '../../data/resume';
  import { LAYOUTS, blendLabelFits, linePath, nearestIndex, niceScale, xAt, yAt, type Layout } from './chart';
  import { blend, decileGroups, decileMae, mse } from './metrics';
  import { generate } from './synth';

  const t = ui.twoModels;
  const uid = $props.id();

  const data = generate();
  const groups = decileGroups(data.y);
  const maeA = decileMae(data.y, data.a, groups);
  const maeB = decileMae(data.y, data.b, groups);
  const mseA = mse(data.y, data.a);
  const mseB = mse(data.y, data.b);
  const scale = niceScale(Math.max(...maeA, ...maeB));
  const DECILES = maeA.map((_, i) => i);
  // Подписи оси — с тем же числом знаков, что у шага: 0, 0.05, 0.10 …
  const tickDigits = (String(scale.step).split('.')[1] ?? '').length;
  const tickLabel = (v: number) => (v === 0 ? '0' : v.toFixed(tickDigits));

  let w = $state(0.6);
  // raw: иначе $state обернёт раскладку в прокси и сравнение с LAYOUTS по ссылке не сработает
  let hover = $state.raw<{ i: number; layout: Layout } | null>(null);
  let announcement = $state('');

  const mixed = $derived(blend(data.a, data.b, w));
  const maeMix = $derived(decileMae(data.y, mixed, groups));
  const mseMix = $derived(mse(data.y, mixed));

  const f2 = (x: number) => x.toFixed(2);
  const f3 = (x: number) => x.toFixed(3);
  const f4 = (x: number) => x.toFixed(4);
  const formula = $derived(t.formula(f2(w), f2(1 - w)));

  /** Номера децилей одной строкой: 2–8 или 1, 9–10. */
  function spans(ds: number[]): string {
    const parts: string[] = [];
    for (let i = 0; i < ds.length; i++) {
      let j = i;
      while (j + 1 < ds.length && ds[j + 1] === ds[j]! + 1) j++;
      parts.push(j > i ? `${ds[i]! + 1}–${ds[j]! + 1}` : String(ds[i]! + 1));
      i = j;
    }
    return parts.join(', ');
  }
  const aBetter = DECILES.filter((i) => maeA[i]! < maeB[i]!);
  const bBetter = DECILES.filter((i) => maeA[i]! >= maeB[i]!);
  const status = $derived(t.blendNow(formula, f4(mseMix), f4(mseA), f4(mseB)));
  const description = $derived(t.describe(spans(aBetter), spans(bBetter), status));

  function move(e: PointerEvent, layout: Layout) {
    const box = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    hover = { i: nearestIndex(layout, ((e.clientX - box.left) / box.width) * layout.width), layout };
  }

  const series = $derived([
    { id: 'a', label: t.modelA, values: maeA },
    { id: 'b', label: t.modelB, values: maeB },
    { id: 'mix', label: t.blend, values: maeMix },
  ]);
</script>

<div class="app">
  <p class="chart-title" id="{uid}-title">{t.chart}</p>

  <div class="chart">
    {#each LAYOUTS as l (l.id)}
      {@const ends = { a: yAt(l, maeA.at(-1)!, scale.max), b: yAt(l, maeB.at(-1)!, scale.max), blend: yAt(l, maeMix.at(-1)!, scale.max) }}
      <svg
        class="plot {l.id}"
        viewBox="0 0 {l.width} {l.height}"
        role="img"
        aria-label={description}
        onpointermove={(e) => move(e, l)}
        onpointerdown={(e) => move(e, l)}
        onpointerleave={() => (hover = null)}
      >
        {#each scale.ticks as tick (tick)}
          <line class="grid" x1={l.left} x2={l.width - l.right} y1={yAt(l, tick, scale.max)} y2={yAt(l, tick, scale.max)} />
          <text class="tick y" x={l.left - 6} y={yAt(l, tick, scale.max) + 4}>{tickLabel(tick)}</text>
        {/each}
        {#each DECILES as i (i)}
          <text class="tick x" x={xAt(l, i)} y={l.height - l.bottom + 16}>{i + 1}</text>
        {/each}
        <text class="axis" x={(l.left + l.width - l.right) / 2} y={l.height - 6}>{t.axisX}</text>

        {#if hover?.layout === l}
          <line class="cross" x1={xAt(l, hover.i)} x2={xAt(l, hover.i)} y1={l.top} y2={l.height - l.bottom} />
        {/if}

        {#each series as s (s.id)}
          <path class="line {s.id}" d={linePath(l, s.values, scale.max)} />
        {/each}
        {#each series as s (s.id)}
          <circle class="dot {s.id}" cx={xAt(l, 9)} cy={yAt(l, s.values.at(-1)!, scale.max)} r="4" />
          {#if hover?.layout === l}
            <circle class="dot {s.id}" cx={xAt(l, hover.i)} cy={yAt(l, s.values[hover.i]!, scale.max)} r="4" />
          {/if}
        {/each}
        <text class="end" x={l.width - l.right + 8} y={ends.a + 4}>{t.modelA}</text>
        <text class="end" x={l.width - l.right + 8} y={ends.b + 4}>{t.modelB}</text>
        {#if blendLabelFits(ends)}
          <text class="end strong" x={l.width - l.right + 8} y={ends.blend + 4}>{t.blend}</text>
        {/if}
      </svg>
    {/each}

    {#if hover}
      {@const x = (100 * xAt(hover.layout, hover.i)) / hover.layout.width}
      <div class="tip" class:left={hover.i <= 2} class:right={hover.i >= 7} style="left: {x}%" aria-hidden="true">
        <p class="tip-head">{t.decile} {hover.i + 1}</p>
        {#each [...series].reverse() as s (s.id)}
          <p class="tip-row"><span class="key {s.id}"></span><strong>{f3(s.values[hover.i]!)}</strong> {s.label}</p>
        {/each}
      </div>
    {/if}
  </div>

  <ul class="legend">
    <li><span class="key a"></span><span><strong>{t.modelA}</strong> — {t.hintA}. <span class="num">{t.mse} {f4(mseA)}</span></span></li>
    <li><span class="key b"></span><span><strong>{t.modelB}</strong> — {t.hintB}. <span class="num">{t.mse} {f4(mseB)}</span></span></li>
    <li class="mix"><span class="key mix"></span><span><strong>{t.blend}</strong> {formula}. <span class="num">{t.mse} {f4(mseMix)}</span></span></li>
  </ul>

  <div class="control">
    <label for="{uid}-w">{t.weight}</label>
    <input
      id="{uid}-w"
      type="range"
      min="0"
      max="1"
      step="0.05"
      bind:value={w}
      aria-valuetext={formula}
      onchange={() => (announcement = status)}
    />
    <output for="{uid}-w" class="num">{formula}</output>
  </div>

  <details>
    <summary>{t.table}</summary>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th scope="col">{t.decile}</th>
            <th scope="col">{t.modelA}</th>
            <th scope="col">{t.modelB}</th>
            <th scope="col">{t.blend}</th>
          </tr>
        </thead>
        <tbody>
          {#each DECILES as i (i)}
            <tr>
              <th scope="row">{i + 1}</th>
              <td>{f3(maeA[i]!)}</td>
              <td>{f3(maeB[i]!)}</td>
              <td>{f3(maeMix[i]!)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </details>

  <p class="visually-hidden" aria-live="polite">{announcement}</p>
</div>

<style>
  .app {
    display: grid;
    gap: var(--space-3);
    min-width: 0;
  }

  .chart-title {
    font-size: var(--fs-14);
    font-weight: 600;
  }

  .chart {
    container: twomodels / inline-size;
    position: relative;
  }

  .plot {
    display: none;
    width: 100%;
    height: auto;
    overflow: visible;
    touch-action: pan-y;
  }

  @container twomodels (max-width: 399px) {
    .plot.xs {
      display: block;
    }
  }

  @container twomodels (min-width: 400px) and (max-width: 639px) {
    .plot.sm {
      display: block;
    }
  }

  @container twomodels (min-width: 640px) {
    .plot.lg {
      display: block;
    }
  }

  .grid {
    stroke: var(--rule);
    stroke-width: 1;
  }

  text {
    fill: var(--muted);
    font-family: var(--font-body);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
  }

  .tick.y {
    text-anchor: end;
  }

  .tick.x,
  .axis {
    text-anchor: middle;
  }

  .end {
    fill: var(--ink);
    font-size: 12px;
  }

  .end.strong {
    font-weight: 600;
  }

  .cross {
    stroke: var(--muted);
    stroke-width: 1;
  }

  .line {
    fill: none;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .line.a,
  .dot.a {
    stroke: var(--chart-a);
  }

  .line.b,
  .dot.b {
    stroke: var(--chart-b);
  }

  .line.mix {
    stroke: var(--ink);
    stroke-width: 3;
  }

  /* Точки с кольцом цвета поверхности — видны, где пересекают линии */
  .dot {
    stroke: var(--surface) !important;
    stroke-width: 2;
  }

  .dot.a {
    fill: var(--chart-a);
  }

  .dot.b {
    fill: var(--chart-b);
  }

  .dot.mix {
    fill: var(--ink);
  }

  .tip {
    position: absolute;
    top: 0;
    z-index: 1;
    display: grid;
    gap: 1px;
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    background: var(--paper);
    font-size: 0.8125rem;
    line-height: 1.3;
    white-space: nowrap;
    pointer-events: none;
    transform: translateX(-50%);
  }

  .tip.left {
    transform: translateX(12px);
  }

  .tip.right {
    transform: translateX(calc(-100% - 12px));
  }

  .tip-head {
    color: var(--muted);
  }

  .tip-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-variant-numeric: tabular-nums;
  }

  /* Ключ серии — короткий отрезок её цвета, текст остаётся цветом текста */
  .key {
    flex: none;
    display: inline-block;
    width: 16px;
    height: 2px;
    background: var(--chart-a);
  }

  .key.b {
    background: var(--chart-b);
  }

  .key.mix {
    height: 3px;
    background: var(--ink);
  }

  .legend {
    display: grid;
    gap: var(--space-1);
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: var(--fs-14);
  }

  .legend li {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    color: var(--muted);
  }

  .legend strong {
    color: var(--ink);
  }

  .legend .key {
    position: relative;
    top: -0.25em;
  }

  .num {
    color: var(--ink);
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .control {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-3);
    font-size: var(--fs-14);
  }

  input[type='range'] {
    flex: 1 1 12rem;
    min-height: 44px;
    accent-color: var(--ink);
  }

  output {
    min-width: 11ch;
  }

  details {
    font-size: var(--fs-14);
  }

  summary {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 44px;
    list-style: none;
    color: var(--muted);
    cursor: pointer;
  }

  summary::-webkit-details-marker {
    display: none;
  }

  summary::before {
    content: '';
    width: 0.5rem;
    height: 0.5rem;
    margin: 0 0.2rem 0 0.1rem;
    border-right: 2px solid currentColor;
    border-bottom: 2px solid currentColor;
    transform: rotate(-45deg);
    transition: transform 0.15s;
  }

  details[open] > summary::before {
    transform: rotate(45deg);
  }

  @media (prefers-reduced-motion: reduce) {
    summary::before {
      transition: none;
    }
  }

  .table-wrap {
    overflow-x: auto;
  }

  table {
    border-collapse: collapse;
    font-variant-numeric: tabular-nums;
  }

  th,
  td {
    padding: 0.15rem var(--space-4) 0.15rem 0;
    text-align: right;
    font-weight: 400;
  }

  thead th {
    color: var(--muted);
  }

  th[scope='row'] {
    text-align: left;
  }

  td {
    font-family: var(--font-mono);
  }
</style>
