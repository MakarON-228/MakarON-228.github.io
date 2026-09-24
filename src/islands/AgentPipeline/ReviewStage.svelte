<script lang="ts">
  // Станция Review: четыре эксперта работают одновременно (в коде — ThreadPoolExecutor на четыре потока), их линии
  // сходятся к модератору; под ним — вердикт и балл, которые платформа вытащила из его ответа.
  import { ui } from '../../data/resume';
  import AgentNode from './AgentNode.svelte';
  import { MODERATOR, PANEL, type AgentState, type EvaluationResult } from './run';

  interface Props {
    stateOf: (id: string) => AgentState;
    selected: string | null;
    onselect: (id: string) => void;
    done: number;
    result: EvaluationResult | null;
  }

  let { stateOf, selected, onselect, done, result }: Props = $props();
  const t = ui.agentPipeline;
</script>

<div class="stage">
  <div class="panel">
    <ul class="experts">
      {#each PANEL as a (a.id)}
        <li>
          <AgentNode agent={a} state={stateOf(a.id)} stateLabel={t.states[stateOf(a.id)]} selected={selected === a.id} layout="card" {onselect} />
        </li>
      {/each}
    </ul>
    <div class="merge" aria-hidden="true"></div>
    <div class="moderator">
      <div class="node">
        <AgentNode agent={MODERATOR} state={stateOf(MODERATOR.id)} stateLabel={t.states[stateOf(MODERATOR.id)]} selected={selected === MODERATOR.id} layout="card" {onselect} />
      </div>
      {#if result}
        <p class="verdict {result.verdict.toLowerCase()}">
          <strong>{result.verdict}</strong>
          {#if result.confidence !== null}<span>{t.confidence(result.confidence)}</span>{/if}
        </p>
      {/if}
    </div>
  </div>
  <p class="note">{t.panelNote} <span class="count">{t.progress(done, 5)}</span></p>
</div>

<style>
  .stage {
    container: review / inline-size;
    display: grid;
    gap: var(--space-3);
  }

  .experts {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  /* Отвод от каждого эксперта вниз, к общей шине */
  .experts li {
    position: relative;
    padding-bottom: var(--space-3);
  }

  .experts li::after {
    content: '';
    position: absolute;
    left: 50%;
    bottom: 0;
    width: 3px;
    height: var(--space-3);
    margin-left: -1.5px;
    background: var(--line-agents);
  }

  /* Шина от центра первого столбца до центра последнего и отвод к модератору */
  .merge {
    position: relative;
    height: var(--space-4);
    margin: 0 12.5%;
    border-top: 3px solid var(--line-agents);
  }

  .merge::after {
    content: '';
    position: absolute;
    left: 50%;
    top: 0;
    bottom: 0;
    width: 3px;
    margin-left: -1.5px;
    background: var(--line-agents);
  }

  .moderator {
    display: grid;
    justify-items: center;
    gap: var(--space-2);
  }

  .moderator .node {
    width: min(100%, 16rem);
  }

  .verdict {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: center;
    gap: var(--space-1) var(--space-3);
    font-variant-numeric: tabular-nums;
  }

  .verdict strong {
    padding: 0.1rem var(--space-2);
    border: 2px solid var(--muted);
    border-radius: 999px;
    font-family: var(--font-mono);
    font-size: var(--fs-14);
  }

  .verdict.approve strong {
    border-color: var(--line-agents);
  }

  .verdict.reject strong {
    border-color: var(--line-rail);
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

  /* Узко: эксперты друг под другом, шина — слева, модератор — в её конце */
  @container review (max-width: 559px) {
    .experts {
      grid-template-columns: minmax(0, 1fr);
      padding-left: var(--space-4);
      border-left: 3px solid var(--line-agents);
      margin-left: 6px;
    }

    .experts li {
      padding-bottom: 0;
    }

    .experts li::after {
      left: calc(-1 * var(--space-4));
      top: 50%;
      bottom: auto;
      width: var(--space-4);
      height: 3px;
      margin: -1.5px 0 0;
    }

    .merge {
      height: var(--space-3);
      margin: 0 0 0 6px;
      border-top: 0;
      border-left: 3px solid var(--line-agents);
    }

    .merge::after {
      display: none;
    }

    .moderator {
      justify-items: start;
    }

    .verdict {
      justify-content: start;
    }
  }
</style>
