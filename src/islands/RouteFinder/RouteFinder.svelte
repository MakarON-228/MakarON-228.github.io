<script lang="ts">
  // Остров RouteFinder (SPEC.md §7.8): пайплайн SIBUR в браузере — цель, масса и требования к составу продукта на входе,
  // все цепочки со склада с подобранной смесью партий и сложностью CatBoost на выходе. Считается сразу при вводе;
  // неверный ввод не сбрасывает список — остаётся результат последнего верного.
  import { CORUNDUM, conditionLabels, type Reaction } from '../../data/demo/alumina-reactions';
  import { COMPONENTS, type Component } from '../../data/demo/alumina-warehouse';
  import { ui } from '../../data/resume';
  import { stepScore } from './complexity';
  import Graph from './Graph.svelte';
  import { boundaryDeterminant, type Bounds, type Spec } from './mix';
  import { NOTEBOOK_MASS, NOTEBOOK_SPEC, reactionById, run, substanceById, targets, type Route } from './pipeline';

  const t = ui.routeFinder;
  const uid = $props.id();

  const presets: { label: string; spec: Spec }[] = [
    { label: t.notebookSpec, spec: NOTEBOOK_SPEC },
    { label: t.lowIron, spec: { ...NOTEBOOK_SPEC, fe_percent: '<0.005' } },
  ];

  const key = (r: Route) => `${r.chain.join('-')}:${r.source}`;
  const label = (id: number) => substanceById.get(id)!.label;
  const conditions = (r: Reaction) => [`${r.temperature} °C`, r.conditions && (conditionLabels[r.conditions] ?? r.conditions)].filter(Boolean).join(', ');
  const chainText = (r: Route) => [label(r.source), ...r.chain.map((id) => label(reactionById.get(id)!.target))].join(' → ');
  const score = (x: number) => x.toFixed(2);
  const kg = (x: number) => x.toFixed(2);
  const pct = (fraction: number) => {
    const v = fraction * 100;
    return `${v >= 1 ? v.toFixed(2) : Number(v.toPrecision(3))} %`;
  };

  const initial = { target: CORUNDUM, mass: NOTEBOOK_MASS, spec: NOTEBOOK_SPEC, bounds: (boundaryDeterminant(NOTEBOOK_SPEC) as { bounds: Bounds }).bounds };
  let target = $state(CORUNDUM);
  let massText = $state(String(NOTEBOOK_MASS));
  let spec = $state.raw<Spec>(NOTEBOOK_SPEC);
  let applied = $state.raw(initial);
  let selected = $state<string | null>(null);
  let preview = $state<string | null>(null);
  let announcement = $state('');

  const parsed = $derived(boundaryDeterminant(spec));
  const invalid = $derived<readonly Component[]>('invalid' in parsed ? parsed.invalid : []);
  const mass = $derived(Number(massText));
  const massOk = $derived(massText.trim() !== '' && Number.isFinite(mass) && mass > 0);

  const outcome = $derived(run(applied.target, applied.mass, applied.bounds));
  const routes = $derived([...outcome.ranked, ...outcome.dropped]);
  const shown = $derived(routes.find((r) => key(r) === (preview ?? selected)) ?? outcome.ranked[0] ?? null);
  // Список свёрнут, чтобы демо не растягивало страницу: итог виден в строке над ним и на графе. Лучший маршрут внутри
  // раскрыт сразу — кто развернёт список, и до гидратации, и без JS увидит его смесь партий.
  let listOpen = $state(false);
  let open = $state.raw(new Set(outcome.ranked[0] ? [key(outcome.ranked[0])] : []));

  const summary = $derived(
    t.summary(
      outcome.ranked.length,
      label(applied.target),
      outcome.dropped.length,
      outcome.ranked[0] ? `${chainText(outcome.ranked[0])}, ${t.complexity.toLowerCase()} ${score(outcome.ranked[0].complexity)}` : null,
    ),
  );
  const graphDescription = $derived(`${t.graph}. ${shown ? chainText(shown) : ''}`);

  function apply() {
    if (!massOk || !('bounds' in parsed)) return;
    const retarget = target !== applied.target;
    applied = { target, mass, spec, bounds: parsed.bounds };
    if (retarget) {
      selected = null;
      open = new Set(outcome.ranked[0] ? [key(outcome.ranked[0])] : []);
    }
    announcement = summary;
  }

  function setComponent(c: Component, value: string) {
    spec = { ...spec, [c]: value.trim() };
    apply();
  }

  function usePreset(p: Spec) {
    spec = p;
    apply();
  }

  function toggle(r: Route) {
    const k = key(r);
    selected = k;
    const next = new Set(open);
    if (!next.delete(k)) next.add(k);
    open = next;
  }

  /** Клик по раскрытой карточке сворачивает её, как клик по строке, — если только в ней не выделяют текст. */
  function collapse(e: MouseEvent, r: Route) {
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed && (e.currentTarget as Node).contains(selection.anchorNode)) return;
    toggle(r);
  }

  const samePreset = (p: Spec) => COMPONENTS.every((c) => p[c] === spec[c]);
</script>

<div class="app">
  <div class="controls">
    <div class="row">
      <label class="field">
        <span>{t.target}</span>
        <select
          value={target}
          onchange={(e) => {
            target = Number(e.currentTarget.value);
            apply();
          }}
        >
          {#each targets as s (s.id)}
            <option value={s.id}>{s.label}{s.name ? ` (${s.name})` : ''}</option>
          {/each}
        </select>
      </label>
      <label class="field mass">
        <span>{t.mass}</span>
        <input
          type="number"
          min="0"
          step="any"
          inputmode="decimal"
          value={massText}
          aria-invalid={!massOk}
          aria-describedby={massOk ? undefined : `${uid}-mass-error`}
          oninput={(e) => {
            massText = e.currentTarget.value;
            apply();
          }}
        />
      </label>
    </div>

    <fieldset class="spec" aria-describedby="{uid}-spec-hint">
      <legend>{t.spec}</legend>
      <div class="fields">
        {#each COMPONENTS as c (c)}
          <label class="field">
            <span>{t.components[c]}</span>
            <input
              type="text"
              value={spec[c]}
              size="7"
              spellcheck="false"
              autocomplete="off"
              aria-invalid={invalid.includes(c)}
              aria-describedby={invalid.includes(c) ? `${uid}-spec-error` : undefined}
              oninput={(e) => setComponent(c, e.currentTarget.value)}
            />
          </label>
        {/each}
      </div>
      <p class="hint" id="{uid}-spec-hint">{t.specHint}</p>
      <div class="presets" role="group" aria-label={t.presets}>
        {#each presets as p (p.label)}
          <button type="button" aria-pressed={samePreset(p.spec)} onclick={() => usePreset(p.spec)}>{p.label}</button>
        {/each}
      </div>
    </fieldset>

    {#if !massOk}
      <p class="error" id="{uid}-mass-error">{t.invalidMass} {t.stale}</p>
    {/if}
    {#if invalid.length}
      <p class="error" id="{uid}-spec-error">{invalid.map((c) => t.components[c]).join(', ')}: {t.invalidSpec} {t.stale}</p>
    {/if}
  </div>

  <Graph route={shown} target={applied.target} label={t.graph} description={graphDescription} legendStock={t.legendStock} legendTarget={t.legendTarget} />

  <p class="summary">{summary}</p>

  {#if outcome.ranked.length}
    <details class="ranked" bind:open={listOpen}>
      <summary>
        <h4>{t.ranked(outcome.ranked.length)}</h4>
        <span class="col">{t.complexity}</span>
      </summary>
      <ol class="routes">
        {#each outcome.ranked as r, i (key(r))}
          {@const k = key(r)}
          <li class:shown={shown === r}>
            {@render routeRow(r, i + 1, k)}
            {#if open.has(k)}
              {@render details(r, k)}
            {/if}
          </li>
        {/each}
      </ol>
    </details>
  {:else}
    <p class="empty">{t.noRoutes}</p>
  {/if}

  {#if outcome.dropped.length}
    <details class="dropped">
      <summary>{t.dropped(outcome.dropped.length)}</summary>
      <ul class="routes">
        {#each outcome.dropped as r (key(r))}
          <li class:shown={shown === r}>{@render routeRow(r, null, key(r))}</li>
        {/each}
      </ul>
    </details>
  {/if}

  <p class="visually-hidden" aria-live="polite">{announcement}</p>
</div>

{#snippet routeRow(r: Route, rank: number | null, k: string)}
  <button
    type="button"
    class="route"
    aria-expanded={rank === null ? undefined : open.has(k)}
    aria-controls={rank !== null && open.has(k) ? `${uid}-${k}` : undefined}
    onclick={() => (rank === null ? (selected = k) : toggle(r))}
    onmouseenter={() => (preview = k)}
    onmouseleave={() => (preview = null)}
    onfocus={() => (preview = k)}
    onblur={() => (preview = null)}
  >
    <span class="rank">{rank ?? '–'}</span>
    <span class="chain">
      <span class="sub">
        {label(r.source)}
        {#if substanceById.get(r.source)!.name}<span class="name">{substanceById.get(r.source)!.name}</span>{/if}
      </span>
      {#each r.chain as id (id)}
        {@const rx = reactionById.get(id)!}
        <!-- Стрелка переносится вместе со следующим веществом -->
        <span class="hop">
          <span class="step">
            <span class="cond">{conditions(rx)}</span>
            <span class="arrow" aria-hidden="true"></span>
            <span class="visually-hidden">→</span>
          </span>
          <span class="sub">{label(rx.target)}</span>
        </span>
      {/each}
    </span>
    <span class="score">{score(r.complexity)}</span>
  </button>
{/snippet}

{#snippet details(r: Route, k: string)}
  <!-- С клавиатуры карточку сворачивает кнопка строки; здесь — только щелчок мышью или тап по всей карточке -->
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="details" id="{uid}-{k}" onclick={(e) => collapse(e, r)}>
    <section>
      <h5>{t.complexityNote}</h5>
      <table>
        <tbody>
          {#each r.chain as id, i (id)}
            {@const rx = reactionById.get(id)!}
            <tr>
              <th scope="row">{label(i === 0 ? r.source : reactionById.get(r.chain[i - 1]!)!.target)} → {label(rx.target)}</th>
              <td>{score(stepScore(id))}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </section>
    {#if r.mix}
      <section>
        <h5>{t.mix(String(Number(applied.mass.toFixed(2))), label(applied.target))}</h5>
        <table>
          <tbody>
            {#each r.mix.masses.filter((m) => m.kg > 0) as m (m.batch.id)}
              <tr><th scope="row">{t.batch(m.batch.id)}</th><td>{kg(m.kg)} kg</td></tr>
            {/each}
            <tr class="total"><th scope="row">{t.total}</th><td>{kg(r.mix.masses.reduce((s, m) => s + m.kg, 0))} kg</td></tr>
          </tbody>
        </table>
      </section>
      <section>
        <h5>{t.product}</h5>
        <table>
          <thead><tr><td></td><th scope="col">%</th><th scope="col">{t.allowed}</th></tr></thead>
          <tbody>
            {#each COMPONENTS as c (c)}
              <tr><th scope="row">{t.components[c]}</th><td>{pct(r.mix.content[c])}</td><td class="allowed">{applied.spec[c]}</td></tr>
            {/each}
          </tbody>
        </table>
      </section>
    {/if}
  </div>
{/snippet}

<style>
  .app {
    display: grid;
    gap: var(--space-4);
    min-width: 0;
  }

  .controls {
    display: grid;
    gap: var(--space-3);
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3) var(--space-4);
  }

  .field {
    display: grid;
    gap: var(--space-1);
    font-size: var(--fs-14);
    color: var(--muted);
  }

  select,
  input,
  button {
    min-height: 44px;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    background: var(--paper);
    color: var(--ink);
    font: inherit;
    font-size: var(--fs-16);
  }

  select {
    padding: 0 var(--space-3);
    max-width: 100%;
  }

  input {
    padding: 0 var(--space-2);
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
  }

  .mass input {
    width: 8rem;
  }

  input[aria-invalid='true'] {
    border-color: var(--line-rail);
    box-shadow: inset 0 0 0 1px var(--line-rail);
  }

  .spec {
    display: grid;
    gap: var(--space-2);
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
  }

  legend {
    padding: 0;
    margin-bottom: var(--space-1);
    font-size: var(--fs-14);
    color: var(--muted);
  }

  .fields {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(6.5rem, 1fr));
    gap: var(--space-2);
  }

  .fields input {
    width: 100%;
    min-width: 0;
  }

  .hint {
    font-size: var(--fs-14);
    color: var(--muted);
  }

  .presets {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .presets button {
    padding: 0 var(--space-4);
    font-weight: 600;
    cursor: pointer;
  }

  .presets button:hover {
    border-color: var(--muted);
  }

  .presets button[aria-pressed='true'] {
    background: var(--ink);
    border-color: var(--ink);
    color: var(--paper);
  }

  .error {
    color: var(--line-rail);
    font-size: var(--fs-14);
  }

  .summary {
    font-size: var(--fs-14);
    color: var(--muted);
  }

  summary {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 44px;
    list-style: none;
    cursor: pointer;
    color: var(--muted);
    font-size: var(--fs-14);
  }

  summary::-webkit-details-marker {
    display: none;
  }

  /* Шеврон вместо стандартного треугольника: flex на summary его убирает */
  summary::before {
    content: '';
    flex: none;
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

  .ranked .col {
    margin-left: auto;
  }

  /* Свёрнутому заголовку — вся ширина: на 360px он встаёт в одну строку */
  .ranked:not([open]) .col {
    display: none;
  }

  h4 {
    font-family: var(--font-display);
    font-size: var(--fs-22);
    font-weight: 700;
    color: var(--ink);
  }

  .routes {
    display: grid;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .routes li {
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    background: var(--paper);
  }

  .routes li.shown {
    border-color: var(--line-craft);
    box-shadow: inset 4px 0 0 var(--line-craft);
  }

  button.route {
    display: grid;
    grid-template-columns: 1.5rem minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--space-3);
    width: 100%;
    padding: var(--space-2) var(--space-3);
    border: 0;
    background: none;
    text-align: left;
    cursor: pointer;
  }

  .rank {
    font-family: var(--font-display);
    font-size: var(--fs-22);
    font-weight: 700;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }

  .chain {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: var(--space-1) var(--space-2);
  }

  .sub {
    font-weight: 600;
    white-space: nowrap;
  }

  .name {
    margin-left: var(--space-1);
    font-weight: 400;
    color: var(--muted);
    font-size: var(--fs-14);
  }

  .hop {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: var(--space-1) var(--space-2);
    min-width: 0;
  }

  .step {
    display: inline-grid;
    justify-items: center;
    min-width: 2.5rem;
  }

  /* Длинные условия («70–90 MPa, hydrothermal process») переносятся, а не распирают строку на телефоне */
  .cond {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--muted);
    text-align: center;
  }

  .arrow {
    position: relative;
    width: 100%;
    height: 2px;
    margin: 0.35rem 0 0.55rem;
    background: var(--muted);
  }

  .arrow::after {
    content: '';
    position: absolute;
    right: -1px;
    top: -4px;
    border: 5px solid transparent;
    border-left: 7px solid var(--muted);
    border-right: 0;
  }

  .score {
    font-family: var(--font-display);
    font-size: var(--fs-22);
    font-weight: 700;
    color: var(--line-science);
    font-variant-numeric: tabular-nums;
  }

  .details {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
    gap: var(--space-4);
    padding: 0 var(--space-3) var(--space-3) calc(1.5rem + 2 * var(--space-3));
    font-size: var(--fs-14);
    cursor: pointer;
  }

  h5 {
    margin-bottom: var(--space-1);
    font-size: var(--fs-14);
    font-weight: 600;
    color: var(--muted);
  }

  table {
    border-collapse: collapse;
    font-variant-numeric: tabular-nums;
  }

  th,
  td {
    padding: 0.1rem var(--space-3) 0.1rem 0;
    text-align: left;
    font-weight: 400;
  }

  td {
    font-family: var(--font-mono);
  }

  thead th,
  .allowed {
    color: var(--muted);
  }

  .total th,
  .total td {
    border-top: 1px solid var(--rule);
    font-weight: 600;
  }

  .empty {
    color: var(--muted);
  }

  details .routes {
    margin-top: var(--space-2);
  }

  .dropped .score {
    color: var(--muted);
  }

  @media (max-width: 479px) {
    /* Номер и сложность — первой строкой, цепочка — во всю ширину под ними */
    button.route {
      grid-template-columns: 1.5rem minmax(0, 1fr);
      grid-template-areas:
        'rank score'
        'chain chain';
    }

    .rank {
      grid-area: rank;
    }

    .score {
      grid-area: score;
      justify-self: end;
    }

    .chain {
      grid-area: chain;
    }

    .details {
      padding-left: var(--space-3);
    }
  }
</style>
