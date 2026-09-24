<script lang="ts">
  // Станция Deep research: девять агентов по очереди. Над цепочкой — дуги контекста для работающего или выбранного
  // агента: от кого он читает выводы, толщина — лимит compact_text. Итоги появляются, когда отработал агент,
  // из чьего ответа их разбирает код: решение и feasibility — Risk Analyst, оценки — Quality Reviewer, резюме — синтез.
  import { research } from '../../data/demo/yandex-agents';
  import { ui } from '../../data/resume';
  import AgentNode from './AgentNode.svelte';
  import { ARC_H, ARC_W, UNIT, arcPath, arcWidth } from './arcs';
  import { agentById, type AgentState, type Input, type ResearchResult } from './run';

  interface Props {
    stateOf: (id: string) => AgentState;
    selected: string | null;
    onselect: (id: string) => void;
    done: number;
    /** Чьи дуги рисовать и что он читает. */
    focus: string | null;
    inputs: Input[];
    result: ResearchResult;
  }

  let { stateOf, selected, onselect, done, focus, inputs, result }: Props = $props();
  const t = ui.agentPipeline;
  const index = new Map(research.map((a, i) => [a.id, i]));
  const n = research.length;

  const arcs = $derived(
    focus && index.has(focus)
      ? inputs.filter((i) => i.limit !== null).map((i) => ({ from: index.get(i.from)!, to: index.get(focus)!, width: arcWidth(i.limit!) }))
      : [],
  );
  const isDone = (id: string) => stateOf(id) === 'done';
</script>

<div class="stage">
  <div class="chain-wrap" style="--done: {Math.max(0, done - 1) / (n - 1)}">
    <svg class="arcs h" viewBox="0 0 {UNIT * n} {ARC_H}" preserveAspectRatio="none" aria-hidden="true">
      {#each arcs as a (a.from)}
        <path d={arcPath(a.from, a.to, false)} stroke-width={a.width} />
      {/each}
    </svg>
    <div class="body">
      <svg class="arcs v" viewBox="0 0 {ARC_W} {UNIT * n}" preserveAspectRatio="none" aria-hidden="true">
        {#each arcs as a (a.from)}
          <path d={arcPath(a.from, a.to, true)} stroke-width={a.width} />
        {/each}
      </svg>
      <ol class="chain">
        {#each research as a (a.id)}
          <li>
            <AgentNode agent={a} state={stateOf(a.id)} stateLabel={t.states[stateOf(a.id)]} selected={selected === a.id} layout="column" {onselect} />
          </li>
        {/each}
      </ol>
    </div>
  </div>

  <p class="note">
    {focus && arcs.length ? t.arcsNote(agentById.get(focus)!.title) : t.chainNote}
    <span class="count">{t.progress(done, n)}</span>
  </p>
  <div class="bar" aria-hidden="true"><span style="width: {(100 * done) / n}%"></span></div>

  {#if isDone('risk_analyst')}
    <p class="outcome">
      <strong class="decision {result.decision === 'NO-GO' ? 'stop' : result.decision === 'GO' || result.decision === 'GO WITH CONDITIONS' ? 'go' : ''}">{result.decision}</strong>
      {#if result.feasibility !== null}<span>{t.feasibility(result.feasibility)}</span>{/if}
      {#if isDone('quality_reviewer')}
        {#if result.quality !== null}<span>{t.quality(result.quality)}</span>{/if}
        {#if result.completeness !== null}<span>{t.completeness(result.completeness)}</span>{/if}
      {/if}
    </p>
  {/if}
  {#if isDone('synthesis_manager')}
    <section class="summary">
      <h4>{t.summary}</h4>
      <p>{result.summary}</p>
    </section>
  {/if}
</div>

<style>
  .stage {
    display: grid;
    gap: var(--space-3);
  }

  .chain-wrap {
    container: chain / inline-size;
  }

  .arcs {
    display: block;
    overflow: visible;
  }

  .arcs path {
    fill: none;
    stroke: var(--line-agents);
    stroke-linecap: round;
    opacity: 0.75;
    vector-effect: non-scaling-stroke;
  }

  .arcs.h {
    width: 100%;
    height: 64px;
  }

  .arcs.v {
    display: none;
  }

  .body {
    position: relative;
  }

  .chain {
    position: relative;
    display: grid;
    grid-template-columns: repeat(9, minmax(0, 1fr));
    margin: 0;
    padding: 0;
    list-style: none;
  }

  /* Линия через центры станций; пройденная часть — цветом линии */
  .chain::before,
  .chain::after {
    content: '';
    position: absolute;
    top: 6px;
    left: calc(100% / 18);
    height: 3px;
    background: var(--rule);
    width: calc(100% - 100% / 9);
  }

  .chain::after {
    width: calc((100% - 100% / 9) * var(--done));
    background: var(--line-agents);
  }

  .chain li {
    position: relative;
    z-index: 1;
  }

  .note {
    color: var(--muted);
    font-size: var(--fs-14);
  }

  .count {
    margin-left: var(--space-2);
    color: var(--ink);
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
  }

  .bar {
    height: 6px;
    overflow: hidden;
    border-radius: 999px;
    background: var(--rule);
  }

  .bar span {
    display: block;
    height: 100%;
    background: var(--line-agents);
  }

  .outcome {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--space-1) var(--space-3);
    font-variant-numeric: tabular-nums;
  }

  .decision {
    padding: 0.1rem var(--space-2);
    border: 2px solid var(--muted);
    border-radius: 999px;
    font-family: var(--font-mono);
    font-size: var(--fs-14);
  }

  .decision.go {
    border-color: var(--line-agents);
  }

  .decision.stop {
    border-color: var(--line-rail);
  }

  .summary {
    display: grid;
    gap: var(--space-1);
    padding-left: var(--space-3);
    border-left: 3px solid var(--line-agents);
    font-size: var(--fs-14);
  }

  h4 {
    font-size: var(--fs-14);
    font-weight: 600;
    color: var(--muted);
  }

  /* Узко: цепочка сверху вниз, дуги — слева от станций */
  @container chain (max-width: 559px) {
    .arcs.h {
      display: none;
    }

    .body {
      padding-left: 48px;
    }

    .arcs.v {
      display: block;
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      width: 48px;
      height: 100%;
    }

    .chain {
      grid-template-columns: minmax(0, 1fr);
      grid-auto-rows: 44px;
    }

    .chain::before,
    .chain::after {
      top: 22px;
      left: 6px;
      width: 3px;
      height: calc(100% - 44px);
    }

    .chain::after {
      height: calc((100% - 44px) * var(--done));
    }
  }
</style>
