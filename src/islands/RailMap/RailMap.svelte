<script lang="ts">
  // Остров RailMap (SPEC.md §7.4): панель дорог, поиск станции, платформы, карточка. До гидратации — та же разметка
  // со статичной заглушкой из сборки; MapLibre и данные грузятся, только когда блок появился на экране.
  import { onMount, type Snippet } from 'svelte';
  import { ui } from '../../data/resume';
  import { createMap, type MapHandle } from './map';
  import { boundsOf, countOf, decode, sortGroups, visibleCount, type GroupInfo, type Point, type SortMode } from './model';
  import { onThemeChange, readColors, roadToken } from './palette';
  import type { LandCollection } from './placeholder';
  import { VIEW } from './projection';
  import { buildIndex, search, translit, type SearchIndex } from './search';

  interface Props {
    groups: GroupInfo[];
    stationsUrl: string;
    landUrl: string;
    children?: Snippet;
  }

  let { groups, stationsUrl, landUrl, children }: Props = $props();

  const t = ui.railMap;
  const uid = $props.id();

  let root: HTMLElement;
  let mapEl: HTMLElement;
  let status = $state<'idle' | 'loading' | 'ready' | 'failed'>('idle');
  let withHalts = $state(false);
  let sortMode = $state<SortMode>('size');
  let selected = $state<number[]>([]);
  let query = $state('');
  let results = $state<number[]>([]);
  let active = $state(-1);
  let open = $state(false);
  let picked = $state<number | null>(null);
  let hovered = $state<number | null>(null);
  let announcement = $state('');
  // Двенадцать тысяч точек реактивность не нужна: они загружаются один раз.
  let points: Point[] = [];
  let index: SearchIndex | null = null;
  let map: MapHandle | null = null;

  const selectedSet = $derived(new Set(selected));
  const order = $derived(sortGroups(groups, sortMode, withHalts));
  const total = $derived(groups.reduce((n, g) => n + countOf(g, withHalts), 0));
  const cardIndex = $derived(hovered ?? picked);
  const card = $derived(cardIndex === null ? null : (points[cardIndex] ?? null));
  const listOpen = $derived(open && results.length > 0);

  const fmt = (n: number) => n.toLocaleString('en-US');
  const groupOf = (p: Point) => groups[p.group]!;
  const swatch = (g: GroupInfo) => `--c: var(${roadToken(g.id)})`;

  function describeSelection(sel: ReadonlySet<number>): string {
    const { stations, halts } = visibleCount(groups, sel, withHalts);
    const count = withHalts ? `${t.stations(stations)}, ${t.haltsCount(halts)}` : t.stations(stations);
    const what = sel.size === 0 ? t.all : sel.size === 1 ? groups[[...sel][0]!]!.nameEn : t.selected(sel.size);
    return t.showing(what, count);
  }

  const describePoint = (i: number) => `${points[i]!.name}, ${groupOf(points[i]!).nameEn}`;

  function applySelection() {
    map?.setSelection(selectedSet);
    map?.fit(boundsOf(points, selectedSet, withHalts) ?? VIEW);
    announcement = describeSelection(selectedSet);
  }

  function toggleRoad(i: number) {
    selected = selected.includes(i) ? selected.filter((x) => x !== i) : [...selected, i];
    applySelection();
  }

  function showAll() {
    selected = [];
    applySelection();
  }

  function onHalts() {
    map?.setHalts(withHalts);
    announcement = describeSelection(selectedSet);
  }

  function runSearch() {
    const found = index ? search(index, query) : { top: [], total: 0 };
    results = found.top;
    active = -1;
    open = query.trim().length > 0;
    announcement = !open ? '' : found.total ? t.matches(found.total) : t.noMatches;
  }

  function choose(i: number) {
    picked = i;
    query = points[i]!.name;
    open = false;
    active = -1;
    map?.focus(i);
    announcement = describePoint(i);
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown' && results.length) {
      open = true;
      active = (active + 1) % results.length;
    } else if (e.key === 'ArrowUp' && results.length) {
      open = true;
      active = (active - 1 + results.length) % results.length;
    } else if (e.key === 'Enter' && results.length) {
      choose(results[Math.max(0, active)]!);
    } else if (e.key === 'Escape' && open) {
      open = false;
      active = -1;
    } else {
      return;
    }
    e.preventDefault();
  }

  function onPick(i: number | null, sticky: boolean) {
    if (!sticky) {
      hovered = i;
      return;
    }
    // Тап на телефоне сначала шлёт синтетическое наведение, а ухода мыши не будет — сбрасываем его.
    hovered = null;
    picked = i;
    map?.mark(i);
    if (i !== null) announcement = describePoint(i);
  }

  async function fetchJson<T>(url: string): Promise<T> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    return (await res.json()) as T;
  }

  onMount(() => {
    let cancelled = false;
    let stopTheme = () => {};
    const ids = groups.map((g) => g.id);
    status = 'loading';
    (async () => {
      const [stations, land] = await Promise.all([fetchJson<Parameters<typeof decode>[0]>(stationsUrl), fetchJson<LandCollection>(landUrl)]);
      points = decode(stations);
      index = buildIndex(points);
      if (query) runSearch();
      const handle = await createMap({
        container: mapEl,
        points,
        land,
        colors: readColors(root, ids),
        hollowGroup: ids.indexOf('unassigned'),
        view: VIEW,
        labels: t,
        reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
        onPick,
      });
      if (cancelled) return handle.destroy();
      map = handle;
      map.setHalts(withHalts);
      map.setSelection(selectedSet);
      if (selected.length) map.fit(boundsOf(points, selectedSet, withHalts) ?? VIEW);
      if (picked !== null) map.focus(picked);
      stopTheme = onThemeChange(() => map?.setColors(readColors(root, ids)));
      status = 'ready';
    })().catch(() => {
      if (!cancelled) status = 'failed';
    });
    return () => {
      cancelled = true;
      stopTheme();
      map?.destroy();
      map = null;
    };
  });
</script>

<div class="app" bind:this={root}>
  <div class="tools">
    <div
      class="search"
      onfocusout={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) open = false;
      }}
    >
      <label for="{uid}-q">{t.search}</label>
      <input
        id="{uid}-q"
        type="search"
        role="combobox"
        aria-expanded={listOpen}
        aria-controls="{uid}-list"
        aria-autocomplete="list"
        aria-activedescendant={listOpen && active >= 0 ? `${uid}-o${active}` : undefined}
        autocomplete="off"
        spellcheck="false"
        placeholder={t.searchHint}
        bind:value={query}
        oninput={runSearch}
        onkeydown={onKeydown}
      />
      <ul id="{uid}-list" class="options" role="listbox" aria-label={t.search} hidden={!listOpen}>
        {#each results as i, k (i)}
          {@const p = points[i]!}
          <li
            id="{uid}-o{k}"
            role="option"
            aria-selected={k === active}
            style={swatch(groupOf(p))}
            onpointerdown={(e) => {
              e.preventDefault();
              choose(i);
            }}
          >
            <span class="swatch" class:hollow={groupOf(p).id === 'unassigned'}></span>
            <span class="option-name">{p.name}</span>
            <span class="option-meta">
              <span class="dot-sep">{translit(p.name)}</span><span class="dot-sep">{p.halt ? t.card.halt : t.card.station}</span>
            </span>
          </li>
        {/each}
      </ul>
    </div>
    <label class="check">
      <input type="checkbox" bind:checked={withHalts} onchange={onHalts} />
      {t.halts}
    </label>
  </div>

  <div class="body">
    <div class="stage" class:ready={status === 'ready'}>
      {@render children?.()}
      <div class="map" bind:this={mapEl}></div>
      {#if card}
        {@const g = groupOf(card)}
        {@const kind = card.halt ? t.card.halt : t.card.station}
        <div class="card">
          <p class="card-name" lang="ru">{card.name}</p>
          <p class="card-latin">{translit(card.name)}</p>
          <!-- На узком экране — одна строка вместо таблицы, чтобы карточка не закрывала карту -->
          <p class="card-line" style={swatch(g)}>
            <span class="swatch" class:hollow={g.id === 'unassigned'}></span>
            {#each [g.nameEn, card.operator, kind, card.esr && `${t.card.esrShort} ${card.esr}`].filter(Boolean) as part (part)}
              <span class="dot-sep">{part}</span>
            {/each}
          </p>
          <dl>
            <dt>{t.card.railway}</dt>
            <dd style={swatch(g)}><span class="swatch" class:hollow={g.id === 'unassigned'}></span>{g.nameEn}</dd>
            {#if card.operator}
              <dt>{t.card.operator}</dt>
              <dd lang="ru">{card.operator}</dd>
            {/if}
            <dt>{t.card.esr}</dt>
            <dd class="num">{card.esr ?? '—'}</dd>
            <dt>{t.card.type}</dt>
            <dd>{kind}</dd>
          </dl>
        </div>
      {/if}
      {#if status === 'loading' || status === 'failed'}
        <p class="status">{status === 'loading' ? t.loading : t.failed}</p>
      {/if}
    </div>

    <div class="roads">
      <div class="roads-head">
        <p class="roads-title" id="{uid}-roads">{t.railways}</p>
        <div class="sort" role="group" aria-label={t.sort}>
          <button type="button" aria-pressed={sortMode === 'size'} onclick={() => (sortMode = 'size')}>{t.bySize}</button>
          <button type="button" aria-pressed={sortMode === 'name'} onclick={() => (sortMode = 'name')}>{t.byName}</button>
        </div>
      </div>
      <ul aria-labelledby="{uid}-roads">
        <li>
          <button type="button" class="road" aria-pressed={selected.length === 0} onclick={showAll}>
            <span class="swatch all"></span>
            <span class="road-name">{t.all}</span>
            <span class="num">{fmt(total)}</span>
          </button>
        </li>
        {#each order as i (groups[i]!.id)}
          {@const g = groups[i]!}
          <li>
            <button type="button" class="road" style={swatch(g)} aria-pressed={selectedSet.has(i)} onclick={() => toggleRoad(i)}>
              <span class="swatch" class:hollow={g.id === 'unassigned'}></span>
              <span class="road-name">{g.nameEn}</span>
              <span class="num">{fmt(countOf(g, withHalts))}</span>
            </button>
          </li>
        {/each}
      </ul>
    </div>
  </div>

  <p class="visually-hidden" aria-live="polite">{announcement}</p>
</div>

<style>
  .app {
    display: grid;
    gap: var(--space-4);
  }

  .tools {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    gap: var(--space-3) var(--space-6);
  }

  .search {
    position: relative;
    flex: 1 1 16rem;
    display: grid;
    gap: var(--space-1);
  }

  label {
    font-size: var(--fs-14);
    font-weight: 600;
  }

  input[type='search'] {
    min-height: 44px;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--muted);
    border-radius: var(--radius);
    background: var(--surface);
    color: var(--ink);
    font: inherit;
  }

  input[type='search']::placeholder {
    color: var(--muted);
  }

  .options {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    z-index: 3;
    margin: var(--space-1) 0 0;
    padding: var(--space-1) 0;
    list-style: none;
    background: var(--surface);
    border: 1px solid var(--rule);
    border-radius: var(--radius);
  }

  .options li {
    display: grid;
    grid-template-columns: 0.75rem minmax(0, 1fr);
    column-gap: var(--space-2);
    align-items: center;
    padding: var(--space-2) var(--space-3);
    cursor: pointer;
  }

  .options li[aria-selected='true'],
  .options li:hover {
    background: var(--paper);
  }

  .option-meta {
    grid-column: 2;
    color: var(--muted);
    font-size: var(--fs-14);
  }

  .check {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 44px;
    cursor: pointer;
  }

  .check input {
    width: 1.1rem;
    height: 1.1rem;
    accent-color: var(--line-science);
  }

  .body {
    display: grid;
    gap: var(--space-4);
  }

  .stage {
    position: relative;
    aspect-ratio: 4 / 3;
    overflow: hidden;
    background: var(--map-water);
    border: 1px solid var(--rule);
    border-radius: var(--radius);
  }

  .stage :global(.placeholder) {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  .map {
    position: absolute;
    inset: 0;
    opacity: 0;
  }

  .ready .map {
    opacity: 1;
  }

  .ready :global(.placeholder) {
    visibility: hidden;
  }

  /* Справа вверху — Северный Ледовитый океан: карточка не закрывает сеть. Слева — кнопки масштаба. */
  .card {
    position: absolute;
    top: var(--space-2);
    right: var(--space-2);
    z-index: 2;
    max-width: min(18rem, calc(100% - 3.5rem));
    padding: var(--space-2) var(--space-3);
    background: var(--surface);
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    font-size: var(--fs-14);
    pointer-events: none;
  }

  .card-name {
    font-weight: 600;
    font-size: var(--fs-16);
  }

  .card-latin {
    color: var(--muted);
  }

  .card-line {
    display: none;
    margin-top: var(--space-1);
  }

  .card-line .dot-sep {
    white-space: nowrap;
  }

  .card-line .swatch {
    display: inline-block;
    margin-right: var(--space-1);
    vertical-align: -0.05em;
  }

  dl {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 0 var(--space-3);
    margin: var(--space-2) 0 0;
  }

  dt {
    color: var(--muted);
  }

  dd {
    margin: 0;
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .status {
    position: absolute;
    left: var(--space-2);
    bottom: var(--space-2);
    padding: var(--space-1) var(--space-2);
    background: var(--surface);
    border-radius: var(--radius);
    color: var(--muted);
    font-size: var(--fs-14);
  }

  .roads {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    min-width: 0;
  }

  .roads-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .roads-title {
    font-family: var(--font-display);
    font-size: var(--fs-22);
    font-weight: 700;
    text-transform: uppercase;
  }

  .sort {
    display: flex;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    overflow: hidden;
  }

  .sort button {
    min-height: 32px;
    padding: 0 var(--space-3);
    border: 0;
    background: transparent;
    color: var(--muted);
    font: inherit;
    font-size: var(--fs-14);
    cursor: pointer;
  }

  .sort button[aria-pressed='true'] {
    background: var(--ink);
    color: var(--paper);
  }

  .roads ul {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr));
    gap: 2px var(--space-3);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .road {
    display: grid;
    grid-template-columns: 0.75rem minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--space-2);
    width: 100%;
    min-height: 32px;
    padding: var(--space-1) var(--space-2);
    border: 0;
    border-radius: var(--radius);
    background: transparent;
    color: var(--ink);
    font: inherit;
    font-size: var(--fs-14);
    text-align: left;
    cursor: pointer;
  }

  .road:hover {
    background: var(--paper);
  }

  .road[aria-pressed='true'] {
    background: var(--paper);
    box-shadow: inset 3px 0 0 var(--c, var(--ink));
    font-weight: 600;
  }

  .swatch {
    width: 0.75rem;
    height: 0.75rem;
    border-radius: 50%;
    background: var(--c);
  }

  .swatch.hollow {
    background: transparent;
    border: 2px solid var(--c);
  }

  .swatch.all {
    background: conic-gradient(var(--line-rail) 0 25%, var(--line-science) 0 50%, var(--line-agents) 0 75%, var(--line-craft) 0);
  }

  .num {
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    color: var(--muted);
  }

  @media (max-width: 719px) {
    .card {
      padding: var(--space-1) var(--space-2);
    }

    .card-line {
      display: block;
    }

    dl {
      display: none;
    }
  }

  @media (min-width: 720px) {
    .stage {
      aspect-ratio: 720 / 372;
    }
  }

  @media (min-width: 960px) {
    .body {
      grid-template-columns: minmax(0, 1fr) 15rem;
    }

    /* Высоту ряда задаёт карта; список дорог прокручивается внутри неё */
    .roads {
      height: 0;
      min-height: 100%;
    }

    .roads ul {
      grid-template-columns: 1fr;
      overflow-y: auto;
      min-height: 0;
    }
  }
</style>
