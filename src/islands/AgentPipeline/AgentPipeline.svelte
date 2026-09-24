<script lang="ts">
  // Остров AgentPipeline (SPEC.md §7.5): платформа команды «AI Болид», где посетитель — ревьюер. Статусы меняются по
  // правилам API платформы (status.ts), агенты запускаются в порядке и с параллельностью из кода (run.ts), вердикт и
  // баллы из их ответов разбирают перенесённые парсеры (parse.ts). Ответы — симуляция. Время запуска идёт по
  // requestAnimationFrame и стоит, пока блок не виден или вкладка скрыта; при reduced motion запуск сразу завершён.
  import { onMount } from 'svelte';
  import { proposals } from '../../data/demo/yandex-proposals';
  import { ui } from '../../data/resume';
  import AgentDetail from './AgentDetail.svelte';
  import ExportStage from './ExportStage.svelte';
  import ResearchStage from './ResearchStage.svelte';
  import ReviewStage from './ReviewStage.svelte';
  import {
    MODERATOR,
    SOURCE_CRAFT,
    TRACKER,
    agentById,
    doneAt,
    evaluationResult,
    inputsOf,
    kindOf,
    lengthOf,
    proposalBody,
    researchResult,
    stepsOf,
    type AgentState,
    type RunKind,
    type Step,
  } from './run';
  import * as S from './status';
  import StatusLine from './StatusLine.svelte';

  type Stage = 'review' | 'research' | 'export';
  const STAGES: Stage[] = ['review', 'research', 'export'];
  const stageOf: Record<RunKind, Stage> = { evaluation: 'review', research: 'research', tracker: 'export', source_craft: 'export' };

  const t = ui.agentPipeline;
  const uid = $props.id();

  let pid = $state(proposals[0]!.id);
  let status = $state<S.ProjectStatus>('submitted');
  let completed = $state.raw(new Set<RunKind>());
  let run = $state.raw<{ kind: RunKind; steps: Step[]; length: number } | null>(null);
  let clock = $state(0);
  let tab = $state<Stage>('review');
  let selected = $state<string | null>(null);
  let queue = $state('BOLID');
  let trackerQueue = $state('BOLID');
  let announcement = $state('');

  const proposal = $derived(proposals.find((p) => p.id === pid)!);
  const evaluated = $derived(evaluationResult(proposal.outputs));
  const researched = $derived(researchResult(proposal.outputs));

  function stateOf(id: string): AgentState {
    const kind = kindOf(agentById.get(id)!);
    if (run?.kind === kind) {
      const s = run.steps.find((x) => x.agent === id)!;
      return clock < s.start ? 'waiting' : clock < s.end ? 'running' : 'done';
    }
    return completed.has(kind) ? 'done' : 'idle';
  }

  /** Сколько агентов запуска уже отработало — как completed_agents в прогрессе платформы. */
  function doneOf(kind: RunKind): number {
    if (run?.kind === kind) return doneAt(run.steps, clock);
    return completed.has(kind) ? stepsOf(kind, proposal).length : 0;
  }

  const answerOf = (id: string) => (id === TRACKER.id ? proposal.tracker(trackerQueue) : (proposal.outputs[id] ?? ''));
  /** Итог через « · »; балл, который парсер не нашёл (null), не выводится. */
  const line = (...parts: (string | null)[]) => parts.filter((x) => x !== null).join(' · ');
  const pts = (label: (n: number) => string, n: number | null) => (n === null ? null : label(n));

  function parsedOf(id: string): string | null {
    if (id === MODERATOR.id) return line(evaluated.verdict, pts(t.confidence, evaluated.confidence));
    if (id === 'risk_analyst') return line(researched.decision, pts(t.feasibility, researched.feasibility));
    if (id === 'quality_reviewer') return line(pts(t.quality, researched.quality), pts(t.completeness, researched.completeness)) || null;
    return null;
  }

  const chosen = $derived(selected ? agentById.get(selected)! : null);
  // Дуги рисуются для выбранного агента цепочки, иначе — для того, кто сейчас работает.
  const running = $derived(run?.kind === 'research' ? (run.steps.find((s) => clock >= s.start && clock < s.end)?.agent ?? null) : null);
  const focus = $derived(chosen?.group === 'research' ? chosen.id : running);

  // --- часы запуска ---
  let root: HTMLElement;
  let raf = 0;
  let last = 0;
  let visible = false;
  let reported = 0;

  function play() {
    if (!run || raf || !visible || document.hidden) return;
    last = performance.now();
    raf = requestAnimationFrame(tick);
  }

  function pause() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function tick(now: number) {
    raf = 0;
    if (!run) return;
    clock = Math.min(run.length, clock + (now - last) / 1000);
    last = now;
    if (clock >= run.length) return finish();
    report();
    raf = requestAnimationFrame(tick);
  }

  /** Объявляет агентов, закончивших с прошлого кадра, — по порядку окончания. */
  function report() {
    if (!run || run.steps.length === 1) return;
    const ended = run.steps.filter((s) => s.end <= clock).sort((a, b) => a.end - b.end);
    if (ended.length <= reported) return;
    announcement = ended
      .slice(reported)
      .map((s, i) => t.finished(agentById.get(s.agent)!.title, reported + i + 1, run!.steps.length))
      .join(' ');
    reported = ended.length;
  }

  function start(kind: RunKind) {
    const steps = stepsOf(kind, proposal);
    run = { kind, steps, length: lengthOf(steps) };
    clock = 0;
    reported = 0;
    tab = stageOf[kind];
    announcement = t.started[kind];
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return finish();
    // Запуск — по клику внутри демо, значит, оно на экране, даже если наблюдатель ещё не успел об этом сообщить.
    visible = true;
    play();
  }

  function finish() {
    if (!run) return;
    pause();
    const kind = run.kind;
    run = null;
    completed = new Set([...completed, kind]);
    if (kind === 'evaluation') {
      announcement = t.evaluated(line(evaluated.verdict, pts(t.confidence, evaluated.confidence)));
    } else if (kind === 'research') {
      status = S.finishDeepResearch(status, true) ?? status;
      announcement = `${t.researched(line(researched.decision, pts(t.feasibility, researched.feasibility)))} ${t.statusNow(t.statuses[status])}`;
    } else {
      announcement = t.exported((kind === 'tracker' ? TRACKER : SOURCE_CRAFT).title);
    }
  }

  // --- действия ревьюера (и один шаг автора заявки) ---
  function move(next: S.ProjectStatus | null) {
    if (!next) return false;
    status = next;
    announcement = t.statusNow(t.statuses[next]);
    return true;
  }

  function runEvaluation() {
    const next = S.startEvaluation(status);
    if (!next) return;
    status = next;
    start('evaluation');
  }

  function resubmit() {
    const draft = S.edit(status);
    // Правка возвращает заявку в черновик, отправка — снова на проверку; старая оценка к новой версии не относится.
    if (draft && move(S.submit(draft))) completed = new Set();
  }

  function runResearch() {
    const next = S.startDeepResearch(status);
    if (!next) return;
    status = next;
    start('research');
  }

  function exportTo(kind: 'tracker' | 'source_craft') {
    if (run || !completed.has('research')) return;
    if (kind === 'tracker') {
      if (!queue.trim()) return;
      trackerQueue = queue.trim();
    }
    start(kind);
  }

  function restart() {
    pause();
    run = null;
    status = 'submitted';
    completed = new Set();
    clock = 0;
    tab = 'review';
    selected = null;
    announcement = t.statusNow(t.statuses[status]);
  }

  function choose(id: string) {
    if (id === pid) return;
    pid = id;
    restart();
  }

  const select = (id: string) => (selected = selected === id ? null : id);

  // --- вкладки: стрелки, Home и End переключают и переводят фокус ---
  let tabs: HTMLButtonElement[] = [];
  function onTabKey(e: KeyboardEvent, i: number) {
    const last = STAGES.length - 1;
    const next = { ArrowRight: i === last ? 0 : i + 1, ArrowLeft: i === 0 ? last : i - 1, Home: 0, End: last }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    tab = STAGES[next]!;
    tabs[next]?.focus();
  }

  onMount(() => {
    const io = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting);
      if (visible) play();
      else pause();
    });
    io.observe(root);
    const onVisibility = () => (document.hidden ? pause() : play());
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      pause();
    };
  });
</script>

<div class="app" bind:this={root}>
  <div class="proposal">
    <div class="picker" role="group" aria-label={t.proposal}>
      {#each proposals as p (p.id)}
        <button type="button" aria-pressed={p.id === pid} onclick={() => choose(p.id)}>{p.title}</button>
      {/each}
    </div>
    <details>
      <summary>{t.proposalBody}</summary>
      <pre>{proposalBody(proposal)}</pre>
    </details>
  </div>

  <StatusLine {status} labels={t.statuses} label={t.status} />

  <div class="controls">
    <div class="actions" role="group" aria-label={t.actions}>
      {#if run}
        <button type="button" class="primary" onclick={finish}>{t.skip}</button>
      {:else}
        {#if S.canReview(status) && status !== 'revision_requested'}
          {#if !completed.has('evaluation')}
            <button type="button" class="primary" onclick={runEvaluation}>{t.runEvaluation}</button>
          {/if}
          <!-- Ни одно решение не выделено: совет модератора не подсказывает кнопку, решает ревьюер -->
          <button type="button" onclick={() => move(S.review(status, 'approve'))}>{t.approve}</button>
          <button type="button" onclick={() => move(S.review(status, 'request_revision'))}>{t.requestRevision}</button>
          <button type="button" onclick={() => move(S.review(status, 'reject'))}>{t.reject}</button>
        {/if}
        {#if status === 'revision_requested'}
          <button type="button" class="primary" onclick={resubmit}>{t.resubmit}</button>
        {/if}
        {#if status === 'accepted_for_research'}
          <button type="button" class="primary" onclick={runResearch}>{t.runResearch}</button>
        {/if}
        {#if status === 'deep_research_completed'}
          <button type="button" class="primary" onclick={() => move(S.publish(status)) && (tab = 'export')}>{t.publish}</button>
        {/if}
        {#if status !== 'submitted' || completed.size}
          <button type="button" onclick={restart}>{t.restart}</button>
        {/if}
      {/if}
    </div>
    {#if S.canReview(status) && status !== 'revision_requested'}
      <p class="advice">{t.advice}</p>
    {/if}
  </div>

  <div class="stages">
    <div class="tabs" role="tablist" aria-label={t.stagesLabel}>
      {#each STAGES as s, i (s)}
        <button
          type="button"
          role="tab"
          id="{uid}-tab-{s}"
          aria-selected={tab === s}
          aria-controls="{uid}-panel"
          tabindex={tab === s ? 0 : -1}
          bind:this={tabs[i]}
          onclick={() => (tab = s)}
          onkeydown={(e) => onTabKey(e, i)}
        >
          {t.stages[s]}
        </button>
      {/each}
    </div>
    <div class="panel" role="tabpanel" id="{uid}-panel" aria-labelledby="{uid}-tab-{tab}">
      {#if tab === 'review'}
        <ReviewStage {stateOf} {selected} onselect={select} done={doneOf('evaluation')} result={stateOf(MODERATOR.id) === 'done' ? evaluated : null} />
      {:else if tab === 'research'}
        <ResearchStage
          {stateOf}
          {selected}
          onselect={select}
          done={doneOf('research')}
          {focus}
          inputs={focus ? inputsOf(agentById.get(focus)!, proposal.outputs) : []}
          result={researched}
        />
      {:else}
        <ExportStage
          {stateOf}
          {selected}
          onselect={select}
          canExport={!run && completed.has('research')}
          bind:queue
          onexport={exportTo}
          showcase={status === 'on_showcase'}
          {proposal}
          {uid}
        />
      {/if}
    </div>
  </div>

  <AgentDetail
    agent={chosen}
    state={chosen ? stateOf(chosen.id) : 'idle'}
    inputs={chosen ? inputsOf(chosen, proposal.outputs) : []}
    parsed={chosen ? parsedOf(chosen.id) : null}
    answer={chosen ? answerOf(chosen.id) : ''}
  />

  <p class="visually-hidden" aria-live="polite">{announcement}</p>
</div>

<style>
  .app {
    display: grid;
    gap: var(--space-4);
    min-width: 0;
  }

  .proposal {
    display: grid;
    gap: var(--space-2);
  }

  .picker,
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  button {
    min-height: 44px;
    padding: 0 var(--space-4);
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    background: var(--paper);
    color: var(--ink);
    font: inherit;
    font-size: var(--fs-14);
    font-weight: 600;
    cursor: pointer;
  }

  button:hover {
    border-color: var(--muted);
  }

  .picker button[aria-pressed='true'],
  .actions .primary {
    background: var(--ink);
    border-color: var(--ink);
    color: var(--paper);
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

  /* Шеврон, как у свёрнутых списков RouteFinder: inline-flex убирает стандартный треугольник */
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

  pre {
    margin: 0;
    padding: var(--space-2) var(--space-3);
    border-left: 3px solid var(--rule);
    background: var(--paper);
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    line-height: 1.5;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .controls {
    display: grid;
    gap: var(--space-2);
  }

  .advice {
    color: var(--muted);
    font-size: var(--fs-14);
  }

  .stages {
    display: grid;
    gap: var(--space-3);
  }

  .tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 0 var(--space-4);
    border-bottom: 1px solid var(--rule);
  }

  [role='tab'] {
    padding: 0;
    border: 0;
    border-bottom: 3px solid transparent;
    border-radius: 0;
    background: none;
    color: var(--muted);
  }

  [role='tab']:hover {
    color: var(--ink);
  }

  [role='tab'][aria-selected='true'] {
    border-bottom-color: var(--line-agents);
    color: var(--ink);
  }
</style>
