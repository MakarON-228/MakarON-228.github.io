<script lang="ts">
  // Граф знаний ApiExplorer: ответ GET /knowledge-graph — интересы и учёные, рёбра учёный → интерес. Выбор учёного
  // (клик, Enter или пробел) вызывает POST /recommend; рекомендованные подсвечены. Две раскладки под ширину блока
  // (container query), фокус по учёным — одна точка табуляции, стрелки двигают.
  import { ui } from '../../data/resume';
  import { LABEL_GAP, LABEL_SIZE, labelOnRight, layoutGraph, type GraphData, type GraphNode } from './graph';

  interface Props {
    data: GraphData;
    as: string;
    /** Узел, для которого считались рекомендации, и рекомендованные узлы. */
    source: number | null;
    recommended: readonly number[];
    onpick: (id: number) => void;
  }

  let { data, as, source, recommended, onpick }: Props = $props();
  const t = ui.apiExplorer.graph;

  const LAYOUTS = [
    { id: 'sm', width: 280, height: 380 },
    { id: 'lg', width: 440, height: 360 },
  ] as const;
  const layouts = $derived(LAYOUTS.map((l) => ({ ...l, ...layoutGraph(data, l.width, l.height) })));

  const names = $derived(new Map(data.interests.map((i) => [i.id, i.name])));
  const interestsOf = $derived(new Map(data.scientists.map((s) => [s.id, s.interests.map((i) => names.get(i)).join(', ')])));
  const scientists = $derived(data.scientists.map((s) => s.id));
  const rec = $derived(new Set(recommended));

  // Активный узел для клавиатуры и подсказки при наведении
  let active = $state<number | null>(null);
  let hover = $state<number | null>(null);
  const tabStop = $derived(active !== null && scientists.includes(active) ? active : (scientists[0] ?? null));
  const nodeEls: Record<string, SVGGElement> = {};

  function key(e: KeyboardEvent, id: number, layout: string) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onpick(id);
      return;
    }
    const i = scientists.indexOf(id);
    const last = scientists.length - 1;
    const next = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: last }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    const target = scientists[(next + scientists.length) % scientists.length]!;
    active = target;
    nodeEls[`${layout}-${target}`]?.focus();
  }

  const hot = (n: GraphNode) => n.id === source || rec.has(n.id);
</script>

<div class="graph">
  <p class="title">{t.title(as)}</p>
  <div class="frame">
    {#each layouts as l (l.id)}
      {@const shown = hover ?? active}
      <svg class="plot {l.id}" viewBox="0 0 {l.width} {l.height}" role="group" aria-label={t.label(data.interests.length, data.scientists.length)}>
        {#each l.edges as [a, b], i (i)}
          {@const s = l.nodes[a]!}
          {@const n = l.nodes[b]!}
          <line class="edge" class:hot={hot(s)} class:shown={s.id === shown} x1={s.x} y1={s.y} x2={n.x} y2={n.y} />
        {/each}
        {#each l.nodes as n (n.kind + n.id)}
          {#if n.kind === 'interest'}
            {@const right = labelOnRight(n.x, l.width)}
            <circle class="interest" cx={n.x} cy={n.y} r="4.5" />
            <text class="label" x={right ? n.x + LABEL_GAP : n.x - LABEL_GAP} y={n.y + LABEL_SIZE * 0.35} text-anchor={right ? 'start' : 'end'}>{n.label}</text>
          {/if}
        {/each}
        {#each l.nodes as n (n.kind + n.id)}
          {#if n.kind !== 'interest'}
            <g
              bind:this={nodeEls[`${l.id}-${n.id}`]}
              class="sci {n.kind}"
              class:rec={rec.has(n.id)}
              class:src={n.id === source}
              role="button"
              tabindex={n.id === tabStop ? 0 : -1}
              aria-label={t.node(n.label, interestsOf.get(n.id) ?? '')}
              aria-pressed={n.id === source}
              onclick={() => onpick(n.id)}
              onkeydown={(e) => key(e, n.id, l.id)}
              onfocus={() => (active = n.id)}
              onpointerenter={() => (hover = n.id)}
              onpointerleave={() => (hover = null)}
            >
              <circle class="hit" cx={n.x} cy={n.y} r="10" />
              <circle class="ring" cx={n.x} cy={n.y} r="7.5" />
              <circle class="dot" cx={n.x} cy={n.y} r={rec.has(n.id) || n.id === source ? 5 : 3.5} />
            </g>
          {/if}
        {/each}
        <!-- Имена: у выбранного и рекомендованных всегда, у остальных — при наведении или фокусе -->
        {#each l.nodes.filter((x) => x.kind !== 'interest' && (x.id === shown || hot(x))) as n (n.id)}
          {@const right = labelOnRight(n.x, l.width)}
          <text class="tip" class:strong={n.id === shown} x={right ? n.x + 8 : n.x - 8} y={n.y - 8} text-anchor={right ? 'start' : 'end'}>{n.label}</text>
        {/each}
      </svg>
    {/each}
  </div>
  <ul class="legend" aria-hidden="true">
    <li><span class="key interest"></span>{t.interest}</li>
    <li><span class="key author"></span>{t.author}</li>
    <li><span class="key user"></span>{t.user}</li>
    <li><span class="key rec"></span>{t.recommended}</li>
  </ul>
  <p class="hint">{t.hint}</p>
</div>

<style>
  .graph {
    display: grid;
    gap: var(--space-2);
    min-width: 0;
  }

  .title,
  .hint {
    font-size: var(--fs-14);
  }

  .title {
    font-weight: 600;
  }

  .hint {
    color: var(--muted);
  }

  .frame {
    container: kgraph / inline-size;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    background: var(--paper);
  }

  .plot {
    display: none;
    width: 100%;
    height: auto;
    touch-action: manipulation;
  }

  @container kgraph (max-width: 399px) {
    .plot.sm {
      display: block;
    }
  }

  @container kgraph (min-width: 400px) {
    .plot.lg {
      display: block;
    }
  }

  .edge {
    stroke: var(--rule);
    stroke-width: 1;
  }

  .edge.shown {
    stroke: var(--muted);
  }

  .edge.hot {
    stroke: var(--line-craft);
    stroke-width: 2;
  }

  .interest {
    fill: var(--line-science);
  }

  .label,
  .tip {
    font-family: var(--font-body);
    font-size: 10px;
    fill: var(--ink);
    paint-order: stroke;
    stroke: var(--paper);
    stroke-width: 3px;
    stroke-linejoin: round;
  }

  .tip {
    pointer-events: none;
  }

  .tip.strong {
    font-weight: 600;
  }

  .sci {
    cursor: pointer;
    outline: none;
  }

  .hit {
    fill: transparent;
  }

  .ring {
    fill: none;
    stroke: none;
  }

  .sci:focus-visible .ring {
    stroke: var(--focus-ring);
    stroke-width: 2;
  }

  .dot {
    fill: var(--muted);
    stroke: var(--muted);
    stroke-width: 1.5;
  }

  .sci.user .dot {
    fill: var(--paper);
  }

  .sci:hover .dot {
    stroke: var(--ink);
  }

  .sci.rec .dot {
    fill: var(--line-craft);
    stroke: var(--ink);
  }

  .sci.src .dot {
    fill: var(--ink);
    stroke: var(--ink);
  }

  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1) var(--space-4);
    margin: 0;
    padding: 0;
    list-style: none;
    color: var(--muted);
    font-size: var(--fs-14);
  }

  .legend li {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .key {
    display: inline-block;
    width: 9px;
    height: 9px;
    border: 1.5px solid var(--muted);
    border-radius: 50%;
    background: var(--muted);
  }

  .key.interest {
    border-color: var(--line-science);
    background: var(--line-science);
  }

  .key.user {
    background: transparent;
  }

  .key.rec {
    border-color: var(--ink);
    background: var(--line-craft);
  }
</style>
