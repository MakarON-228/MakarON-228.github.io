<script lang="ts">
  // Остров ApiExplorer (SPEC.md §7.7): панель в духе Swagger UI над портом бэкенда Academic Profile, который отвечает
  // прямо в странице. Слева эндпоинты, справа консоль: параметры, тело, Execute, curl и ответ. Для /recommend и
  // /knowledge-graph — граф знаний, выбор учёного вызывает /recommend. Бэкенд создаётся при первом запросе, словарь
  // модели команды грузится отдельным чанком, когда он впервые нужен.
  import { onMount } from 'svelte';
  import { endpoints, type Endpoint } from '../../data/demo/academic-endpoints';
  import { DEMO_LOGIN, SAMPLE_CSV, authorInterests } from '../../data/demo/academic-scientists';
  import { ui } from '../../data/resume';
  import Graph from './Graph.svelte';
  import type { GraphData } from './graph';
  import { STATUS_TEXT, initialForm, prepare, type FileInput, type Form } from './http';
  import { jsonTokens } from './json';
  import { Backend, type ApiResponse } from './server';

  interface Shown {
    url: string;
    curl: string;
    res: ApiResponse;
    /** null — ответ посчитан при сборке сайта. */
    ms: number | null;
  }

  interface Props {
    /** Ответ на пример /recommend и граф для демо-пользователя — посчитаны при сборке тем же портом. */
    initial: { recommend: Shown; graph: GraphData; graphAs: string };
  }

  const { initial }: Props = $props();
  const t = ui.apiExplorer;
  const uid = $props.id();
  const byId = new Map(endpoints.map((e) => [e.id, e]));
  const GRAPH_ENDPOINTS = new Set(['recommend', 'knowledge-graph']);
  const enc = new TextEncoder();

  let selected = $state('recommend');
  const ep = $derived(byId.get(selected)!);
  let forms = $state<Record<string, Form>>(Object.fromEntries(endpoints.map((e) => [e.id, initialForm(e)])));
  let file = $state.raw<FileInput | null>(null);
  let results = $state.raw<Record<string, Shown>>({ recommend: initial.recommend });
  let token = $state<string | null>(null);
  let authorizedAs = $state<string | null>(null);
  let graph = $state.raw<GraphData>(initial.graph);
  let graphAs = $state(initial.graphAs);
  let source = $state<number | null>(null);
  const firstRecommended = recommendedNodes(initial.recommend.res, null);
  let recommended = $state.raw<number[]>(firstRecommended);
  let busy = $state(false);
  let announcement = $state('');
  let recommendNote = $state(recommendText(firstRecommended, null));
  let backend: Backend | null = null;

  const result = $derived(results[selected]);
  const sample = { name: SAMPLE_CSV.name, bytes: enc.encode(SAMPLE_CSV.text) };

  function newBackend(): Backend {
    const key = crypto.getRandomValues(new Uint8Array(32));
    return new Backend({
      secret: [...key].map((b) => b.toString(16).padStart(2, '0')).join(''),
      model: () => import('../../data/demo/academic-tfidf.json').then((m) => m.default),
    });
  }

  /** author_id из ответа /recommend → id узла графа (author_interests.id + 100000), без самого учёного. */
  function recommendedNodes(res: ApiResponse, except: number | null): number[] {
    if (res.status !== 200) return [];
    const recs = (res.body as { recommendations: { author_id: string }[] }).recommendations;
    const ids = recs.map((r) => authorInterests.find((a) => a.author_id === r.author_id)!.id + 100000);
    return ids.filter((id) => id !== except).slice(0, 3);
  }

  function nameOf(id: number): string {
    return graph.scientists.find((s) => s.id === id)?.name ?? authorInterests.find((a) => a.id + 100000 === id)?.author_name ?? '';
  }

  function recommendText(ids: readonly number[], from: number | null): string {
    const names = ids.map(nameOf).join(', ');
    if (from !== null) return ids.length ? t.graph.forScientist(nameOf(from), names) : t.graph.none(nameOf(from));
    return ids.length ? t.graph.forQuery(names) : '';
  }

  async function execute(target: Endpoint = ep, from: number | null = null) {
    if (busy) return;
    busy = true;
    const prepared = prepare(target, forms[target.id]!, target.body?.kind === 'file' ? (file ?? sample) : null, token);
    backend ??= newBackend();
    const t0 = performance.now();
    const res = await backend.handle(prepared.req);
    const ms = performance.now() - t0;
    results = { ...results, [target.id]: { url: prepared.url, curl: prepared.curl, res, ms } };
    busy = false;

    let note = t.announce(res.status, STATUS_TEXT[res.status] ?? '', target.method, prepared.req.path);
    if (target.id === 'login' && res.status === 200) {
      token = (res.body as { access_token: string }).access_token;
      const sub = JSON.parse(atob(token.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/'))) as { sub: string };
      authorizedAs = backend.users.find((u) => String(u.id) === sub.sub)?.login ?? '';
      note += `. ${t.authorized(authorizedAs)}`;
    }
    if (target.id === 'knowledge-graph' && res.status === 200) {
      graph = res.body as GraphData;
      graphAs = authorizedAs ?? '';
      source = null;
      recommended = [];
      recommendNote = '';
    }
    if (target.id === 'recommend') {
      source = from;
      recommended = recommendedNodes(res, from);
      recommendNote = recommendText(recommended, from);
      if (res.status === 200) note += `. ${recommendNote}`;
    }
    announcement = note;
  }

  /** Учёный на графе → POST /recommend с его интересами; четыре ответа, потому что сам он окажется среди них. */
  function pick(id: number) {
    const s = graph.scientists.find((x) => x.id === id);
    if (!s) return;
    const interests = s.interests.map((i) => graph.interests.find((x) => x.id === i)!.name);
    forms.recommend!.body = JSON.stringify({ interests, num_recommendations: 4 }, null, 2);
    selected = 'recommend';
    void execute(byId.get('recommend')!, id);
  }

  function logout() {
    token = null;
    authorizedAs = null;
    announcement = t.loggedOut;
  }

  function resetData() {
    backend = null;
    logout();
    results = {};
    graph = initial.graph;
    graphAs = initial.graphAs;
    source = null;
    recommended = [];
    recommendNote = '';
    announcement = t.resetDone;
  }

  async function chooseFile(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const f = input.files?.[0];
    if (!f) return;
    file = { name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) };
  }

  function onFieldKey(e: KeyboardEvent) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void execute();
    }
  }

  // --- список эндпоинтов: стрелки вверх и вниз, Home и End, как вкладки ---
  const tabs: HTMLButtonElement[] = [];
  function onTabKey(e: KeyboardEvent, i: number) {
    const last = endpoints.length - 1;
    const next = { ArrowDown: i === last ? 0 : i + 1, ArrowUp: i === 0 ? last : i - 1, Home: 0, End: last }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    selected = endpoints[next]!.id;
    tabs[next]?.focus();
  }

  const rows = (s: string) => Math.min(Math.max(s.split('\n').length, 3), 14);

  onMount(() => {
    // Страница уже в браузере: создать бэкенд заранее, чтобы первый Execute не ждал засева базы
    backend ??= newBackend();
  });
</script>

{#snippet lock()}
  <svg class="lock" viewBox="0 0 12 14" aria-hidden="true"><rect x="1" y="6" width="10" height="7" rx="1.5" /><path d="M3.5 6V4a2.5 2.5 0 0 1 5 0v2" /></svg>
{/snippet}

{#snippet path(p: string)}
  <code class="path">{#each p.split('/').slice(1) as seg, i (i)}<wbr />/{seg}{/each}</code>
{/snippet}

{#snippet method(m: string)}
  <span class="method {m.toLowerCase()}">{m}</span>
{/snippet}

<div class="app">
  <div class="auth" class:on={token}>
    {#if token}
      {@render lock()}
      <span>{t.authorizedAs} <strong>{authorizedAs}</strong></span>
      <code class="token">Bearer {token.slice(0, 20)}…</code>
      <button type="button" class="small" onclick={logout}>{t.logout}</button>
    {:else}
      <span>{t.notAuthorized} <code>{DEMO_LOGIN.login_or_email}</code> / <code>{DEMO_LOGIN.password}</code>.</span>
      <button type="button" class="small" onclick={() => (selected = 'login')}>{t.goLogin}</button>
    {/if}
    <button type="button" class="small reset" onclick={resetData}>{t.resetData}</button>
  </div>

  <div class="body">
    <label class="picker">
      <span class="visually-hidden">{t.endpoint}</span>
      <select bind:value={selected}>
        {#each endpoints as e (e.id)}
          <option value={e.id}>{e.method} {e.path}{e.auth ? ` (${t.locked})` : ''}</option>
        {/each}
      </select>
    </label>

    <div class="list" role="tablist" aria-orientation="vertical" aria-label={t.endpoints}>
      {#each endpoints as e, i (e.id)}
        <button
          bind:this={tabs[i]}
          type="button"
          role="tab"
          id="{uid}-tab-{e.id}"
          aria-selected={e.id === selected}
          aria-controls="{uid}-panel"
          tabindex={e.id === selected ? 0 : -1}
          onclick={() => (selected = e.id)}
          onkeydown={(ev) => onTabKey(ev, i)}
        >
          <span class="row">{@render method(e.method)}{@render path(e.path)}</span>
          <span class="summary">
            {e.summary}
            {#if e.auth}{@render lock()}<span class="visually-hidden">, {t.locked}</span>{/if}
          </span>
        </button>
      {/each}
    </div>

    <section class="console" class:with-graph={GRAPH_ENDPOINTS.has(ep.id)} id="{uid}-panel" role="tabpanel" aria-labelledby="{uid}-tab-{ep.id}">
      <div class="request">
        <p class="op">
          {@render method(ep.method)}{@render path(ep.path)}
          <span class="summary">{ep.summary}</span>
          {#if ep.auth}<span class="locked">{@render lock()} {t.locked}</span>{/if}
        </p>

        {#if ep.params.length}
          <fieldset>
            <legend>{t.parameters}</legend>
            {#each ep.params as p (p.name)}
              <label class="param">
                <span class="pname">
                  <code>{p.name}</code>
                  <span class="ptype">{p.type} ({p.in}){p.required ? `, ${t.required}` : ''}</span>
                </span>
                <input
                  type="text"
                  spellcheck="false"
                  autocomplete="off"
                  bind:value={forms[ep.id]!.params[p.name]}
                  placeholder={p.default ?? ''}
                  onkeydown={onFieldKey}
                />
              </label>
            {/each}
          </fieldset>
        {/if}

        {#if ep.body?.kind === 'json'}
          {@const example = ep.body.example}
          <div class="field">
            <label for="{uid}-body">{t.body} <span class="ptype">application/json</span></label>
            <textarea
              id="{uid}-body"
              spellcheck="false"
              rows={rows(forms[ep.id]!.body)}
              bind:value={forms[ep.id]!.body}
              onkeydown={onFieldKey}
            ></textarea>
            <button type="button" class="small" onclick={() => (forms[ep.id]!.body = example)} disabled={forms[ep.id]!.body === example}>
              {t.resetExample}
            </button>
          </div>
        {:else if ep.body?.kind === 'file'}
          <fieldset class="file">
            <legend>{t.body} <span class="ptype">multipart/form-data</span></legend>
            <div class="file-row">
              <button type="button" class="small" aria-pressed={!file} onclick={() => (file = null)}>{t.useSample(SAMPLE_CSV.name)}</button>
              <label class="small choose">
                {t.chooseFile}
                <input type="file" accept=".csv,text/csv" onchange={chooseFile} />
              </label>
              <code class="fname">{file?.name ?? SAMPLE_CSV.name}</code>
            </div>
            <details>
              <summary>{t.showSample}</summary>
              <pre class="code">{SAMPLE_CSV.text}</pre>
            </details>
          </fieldset>
        {/if}

        <div class="actions">
          <button type="button" class="execute" onclick={() => execute()} disabled={busy}>{t.execute}</button>
          <span class="hint">{t.executeHint}</span>
        </div>
      </div>

      {#if GRAPH_ENDPOINTS.has(ep.id)}
        <div class="graph-slot">
          <Graph data={graph} as={graphAs} {source} {recommended} onpick={pick} />
          {#if recommendNote}<p class="rec-note">{recommendNote}</p>{/if}
        </div>
      {/if}

      <div class="response">
        {#if result}
          {#if result.ms === null}<p class="hint">{t.example}</p>{/if}
          <p class="label">{t.curl}</p>
          <pre class="code">{result.curl}</pre>
          <p class="label">{t.url}</p>
          <pre class="code">{result.url}</pre>
          <p class="status">
            <span class="code-dot" class:ok={result.res.status < 400}></span>
            <strong>{result.res.status}</strong>
            {STATUS_TEXT[result.res.status] ?? ''}
            {#if result.ms !== null}<span class="ms">· {t.ms(result.ms)}</span>{/if}
          </p>
          <p class="label">{t.response}</p>
          <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
          <pre class="code json" tabindex="0" role="region" aria-label={t.response}>{#each jsonTokens(result.res.body) as tok, i (i)}<span class={tok.t}>{tok.s}</span>{/each}</pre>
          <p class="label">{t.headers}</p>
          <pre class="code">content-type: application/json{#each Object.entries(result.res.headers) as [k, v] (k)}{`\n${k}: ${v}`}{/each}</pre>
        {:else}
          <p class="hint">{t.notSent}</p>
        {/if}
      </div>
    </section>
  </div>

  <p class="visually-hidden" aria-live="polite">{announcement}</p>
</div>

<style>
  .app {
    container: apiexplorer / inline-size;
    display: grid;
    gap: var(--space-3);
    min-width: 0;
    font-size: var(--fs-14);
  }

  code,
  .code,
  select,
  input,
  textarea {
    font-family: var(--font-mono);
  }

  /* --- полоса авторизации --- */
  .auth {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-3);
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--rule);
    border-left: 3px solid var(--muted);
    border-radius: var(--radius);
    color: var(--muted);
  }

  .auth.on {
    border-left-color: var(--line-agents);
    color: var(--ink);
  }

  .auth strong {
    color: var(--ink);
  }

  .token {
    overflow: hidden;
    max-width: 100%;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .reset {
    margin-left: auto;
  }

  /* --- раскладка: список | консоль на широком блоке, выпадающий список на узком --- */
  .body {
    display: grid;
    gap: var(--space-4);
    min-width: 0;
  }

  .list {
    display: none;
  }

  @container apiexplorer (min-width: 760px) {
    .body {
      grid-template-columns: 14rem minmax(0, 1fr);
      align-items: start;
    }

    .picker {
      display: none;
    }

    .list {
      display: grid;
      gap: 2px;
    }
  }

  .picker select {
    width: 100%;
    min-height: 44px;
    padding: 0 var(--space-2);
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    background: var(--paper);
    color: var(--ink);
    font-size: var(--fs-14);
  }

  .list button {
    display: grid;
    gap: 2px;
    width: 100%;
    padding: var(--space-2);
    border: 1px solid transparent;
    border-radius: var(--radius);
    background: none;
    color: var(--ink);
    text-align: left;
    cursor: pointer;
  }

  .list button:hover {
    border-color: var(--rule);
  }

  .list button[aria-selected='true'] {
    border-color: var(--rule);
    background: var(--paper);
  }

  .row {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    min-width: 0;
  }

  .path {
    min-width: 0;
    font-size: 0.8125rem;
  }

  .summary {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    color: var(--muted);
    font-size: 0.8125rem;
  }

  /* Метод — оттенок цвета линии на фоне, текст — цветом текста (контраст AA в обеих темах) */
  .method {
    --m: var(--line-science);
    flex: none;
    min-width: 3.4rem;
    padding: 0 var(--space-1);
    border-left: 3px solid var(--m);
    border-radius: 3px;
    background: color-mix(in srgb, var(--m) 16%, transparent);
    font-family: var(--font-mono);
    font-size: 0.75rem;
    font-weight: 600;
    text-align: center;
  }

  .method.post {
    --m: var(--line-agents);
  }

  .method.put {
    --m: var(--line-craft);
  }

  .method.delete {
    --m: var(--line-rail);
  }

  .lock {
    flex: none;
    width: 0.7rem;
    height: 0.8rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
  }

  /* --- консоль --- */
  .console {
    display: grid;
    gap: var(--space-4);
    min-width: 0;
  }

  @container apiexplorer (min-width: 1000px) {
    .console.with-graph {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      align-items: start;
    }

    .console.with-graph .response {
      grid-column: 1 / -1;
    }
  }

  .request,
  .response,
  .graph-slot {
    display: grid;
    gap: var(--space-3);
    min-width: 0;
  }

  .op {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--space-1) var(--space-2);
  }

  .op .path {
    font-size: var(--fs-14);
    font-weight: 600;
  }

  .locked {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    color: var(--muted);
  }

  fieldset {
    display: grid;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    border: 0;
  }

  legend,
  .field > label,
  .label {
    padding: 0;
    color: var(--muted);
    font-weight: 600;
  }

  .param {
    display: grid;
    grid-template-columns: minmax(8rem, 12rem) minmax(0, 1fr);
    align-items: center;
    gap: var(--space-2);
  }

  .pname {
    display: grid;
  }

  .ptype {
    color: var(--muted);
    font-size: 0.75rem;
    font-weight: 400;
  }

  input[type='text'],
  textarea {
    width: 100%;
    min-height: 44px;
    padding: var(--space-2);
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    background: var(--paper);
    color: var(--ink);
    font-size: 0.8125rem;
  }

  textarea {
    resize: vertical;
    line-height: 1.45;
  }

  .field {
    display: grid;
    justify-items: start;
    gap: var(--space-2);
  }

  .file-row,
  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-3);
  }

  .choose {
    position: relative;
    display: inline-flex;
    align-items: center;
  }

  .choose input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }

  .choose:focus-within {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .fname {
    overflow-wrap: anywhere;
  }

  button,
  .choose {
    min-height: 44px;
    padding: 0 var(--space-3);
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    background: var(--surface);
    color: var(--ink);
    font: inherit;
    cursor: pointer;
  }

  button:disabled {
    color: var(--muted);
    cursor: default;
  }

  button[aria-pressed='true'] {
    border-color: var(--ink);
  }

  .small {
    min-height: 36px;
  }

  .execute {
    padding-inline: var(--space-6);
    border-color: var(--ink);
    background: var(--ink);
    color: var(--surface);
    font-weight: 600;
  }

  .execute:disabled {
    background: var(--muted);
    color: var(--surface);
  }

  .hint {
    color: var(--muted);
  }

  details summary {
    color: var(--muted);
    cursor: pointer;
  }

  .code {
    overflow: auto;
    margin: 0;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius);
    background: var(--paper);
    font-size: 0.8125rem;
    line-height: 1.45;
    white-space: pre;
  }

  /* Короткие блоки переносятся по строкам; прокручивается только тело ответа — у него есть фокус */
  .code:not(.json) {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .json {
    max-height: 26rem;
  }

  .json .k {
    color: var(--line-science);
  }

  .json .n {
    color: var(--line-rail);
  }

  .json .l {
    color: var(--muted);
  }

  .status {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-family: var(--font-mono);
  }

  .code-dot {
    width: 0.6rem;
    height: 0.6rem;
    border-radius: 50%;
    background: var(--line-rail);
  }

  .code-dot.ok {
    background: var(--line-agents);
  }

  .ms {
    color: var(--muted);
  }

  .rec-note {
    font-weight: 600;
  }

  @container apiexplorer (max-width: 479px) {
    .param {
      grid-template-columns: minmax(0, 1fr);
      gap: var(--space-1);
    }
  }
</style>
