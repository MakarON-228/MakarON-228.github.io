<script lang="ts">
  // Граф реакций (SPEC.md §7.8): станции — вещества, линии — реакции. Выбранный маршрут подсвечен цветом линии Craft,
  // над его перегонами — температура. Сам граф только показывает: управление — в списке маршрутов.
  import { substances } from '../../data/demo/alumina-reactions';
  import { HEIGHT, WIDTH, edges, labelPoint, nodes, roundedPath, type NodeLayout } from './layout';
  import { reactionById, stock } from './pipeline';
  import type { Variant } from './routes';

  interface Props {
    route: Variant | null;
    target: number;
    label: string;
    description: string;
    legendStock: string;
    legendTarget: string;
  }

  let { route, target, label, description, legendStock, legendTarget }: Props = $props();

  /** Рёбра маршрута: первая реакция — от выбранного сырья, дальше — от продукта предыдущей. */
  const onRoute = $derived.by(() => {
    if (!route) return new Set<string>();
    return new Set(route.chain.map((id, i) => `${id}:${i === 0 ? route.source : reactionById.get(route.chain[i - 1]!)!.target}`));
  });
  const routeNodes = $derived(
    route ? new Set([route.source, ...route.chain.map((id) => reactionById.get(id)!.target)]) : new Set<number>(),
  );
  const highlighted = $derived(edges.filter((e) => onRoute.has(`${e.reaction}:${e.source}`)));

  function anchor(n: NodeLayout, lines: number) {
    switch (n.place) {
      case 'right':
        return { x: n.x + 14, y: n.y + 5 - (lines - 1) * 7, a: 'start' };
      case 'below':
        return { x: n.x, y: n.y + 24, a: 'middle' };
      case 'above-right':
        return { x: n.x + 10, y: n.y - 12 - (lines - 1) * 14, a: 'start' };
      default:
        return { x: n.x, y: n.y - 14 - (lines - 1) * 14, a: 'middle' };
    }
  }
</script>

<div class="scroller" role="region" tabindex="0" aria-label={label}>
  <svg class="graph" viewBox="0 0 {WIDTH} {HEIGHT}" role="img" aria-label={description}>
    {#each edges as e (`${e.reaction}:${e.source}`)}
      <path class="track" d={roundedPath(e.points)} />
    {/each}
    {#each highlighted as e (`${e.reaction}:${e.source}`)}
      <path class="route" d={roundedPath(e.points)} />
    {/each}
    {#each highlighted as e (`${e.reaction}:${e.source}`)}
      {@const [x, y] = labelPoint(e.points)}
      <text class="temp" {x} y={y - 8}>{reactionById.get(e.reaction)!.temperature} °C</text>
    {/each}

    {#each substances as s (s.id)}
      {@const n = nodes[s.id]!}
      {@const lines = s.name ? 2 : 1}
      {@const t = anchor(n, lines)}
      <g class="station" class:stock={stock.has(s.id)} class:target={s.id === target} class:on={routeNodes.has(s.id)}>
        {#if s.id === target}<circle class="ring" cx={n.x} cy={n.y} r="12" />{/if}
        <circle cx={n.x} cy={n.y} r="7" />
        <text x={t.x} y={t.y} text-anchor={t.a}>
          {s.label}
          {#if s.name}<tspan class="name" x={t.x} dy="14">{s.name}</tspan>{/if}
        </text>
      </g>
    {/each}
  </svg>
</div>
<p class="legend">
  <span><svg viewBox="0 0 16 16" aria-hidden="true"><circle class="swatch stock" cx="8" cy="8" r="6" /></svg>{legendStock}</span>
  <span><svg viewBox="0 0 16 16" aria-hidden="true"><circle class="swatch ring" cx="8" cy="8" r="6" /></svg>{legendTarget}</span>
</p>

<style>
  .scroller {
    overflow-x: auto;
    overscroll-behavior-x: contain;
    background: var(--paper);
    border: 1px solid var(--rule);
    border-radius: var(--radius);
  }

  .graph {
    display: block;
    width: 100%;
    min-width: 640px;
    height: auto;
    aspect-ratio: 860 / 456;
  }

  path {
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .track {
    stroke: var(--rule);
    stroke-width: 4;
  }

  .route {
    stroke: var(--line-craft);
    stroke-width: 6;
  }

  text {
    fill: var(--ink);
    font-family: var(--font-body);
    font-size: 13px;
  }

  .name {
    fill: var(--muted);
    font-size: 12px;
  }

  .temp {
    font-family: var(--font-mono);
    font-size: 11px;
    text-anchor: middle;
    paint-order: stroke;
    stroke: var(--paper);
    stroke-width: 4px;
    stroke-linejoin: round;
  }

  .station circle {
    fill: var(--surface);
    stroke: var(--muted);
    stroke-width: 2.5;
  }

  .station.on circle {
    stroke: var(--ink);
  }

  .station.stock circle:not(.ring) {
    fill: var(--muted);
  }

  .station.stock.on circle:not(.ring) {
    fill: var(--ink);
  }

  .station .ring,
  .swatch.ring {
    fill: none;
    stroke: var(--line-craft);
    stroke-width: 3;
  }

  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2) var(--space-4);
    color: var(--muted);
    font-size: var(--fs-14);
  }

  .legend span {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
  }

  .legend svg {
    width: 16px;
    height: 16px;
  }

  .swatch.stock {
    fill: var(--muted);
    stroke: var(--muted);
    stroke-width: 2;
  }
</style>
