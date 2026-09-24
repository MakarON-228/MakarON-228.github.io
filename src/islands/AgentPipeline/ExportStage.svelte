<script lang="ts">
  // Станция Export & showcase: два MCP-агента расходятся от завершённого deep research — в Yandex Tracker (как в
  // платформе, нужна очередь) и в SourceCraft; ниже — карточка проекта на витрине, как на странице Showcase.
  import type { Proposal } from '../../data/demo/yandex-proposals';
  import { ui } from '../../data/resume';
  import AgentNode from './AgentNode.svelte';
  import { SOURCE_CRAFT, TRACKER, type AgentState } from './run';

  interface Props {
    stateOf: (id: string) => AgentState;
    selected: string | null;
    onselect: (id: string) => void;
    canExport: boolean;
    queue: string;
    onexport: (kind: 'tracker' | 'source_craft') => void;
    showcase: boolean;
    proposal: Proposal;
    uid: string;
  }

  let { stateOf, selected, onselect, canExport, queue = $bindable(), onexport, showcase, proposal, uid }: Props = $props();
  const t = ui.agentPipeline;
</script>

<div class="stage">
  <ul class="exports">
    <li>
      <div class="node">
        <AgentNode agent={TRACKER} state={stateOf(TRACKER.id)} stateLabel={t.states[stateOf(TRACKER.id)]} selected={selected === TRACKER.id} layout="card" {onselect} />
      </div>
      <label class="queue">
        <span>{t.queue}</span>
        <input type="text" bind:value={queue} size="8" spellcheck="false" autocomplete="off" />
      </label>
      <button type="button" disabled={!canExport || !queue.trim()} onclick={() => onexport('tracker')}>{t.exportTracker}</button>
    </li>
    <li>
      <div class="node">
        <AgentNode agent={SOURCE_CRAFT} state={stateOf(SOURCE_CRAFT.id)} stateLabel={t.states[stateOf(SOURCE_CRAFT.id)]} selected={selected === SOURCE_CRAFT.id} layout="card" {onselect} />
      </div>
      <button type="button" disabled={!canExport} onclick={() => onexport('source_craft')}>{t.exportSourceCraft}</button>
    </li>
  </ul>
  <p class="note">{t.exportNote}</p>

  <section class="showcase" aria-labelledby="{uid}-showcase">
    <h4 id="{uid}-showcase">{t.showcase}</h4>
    {#if showcase}
      <article class="card">
        <span class="badge">{t.statuses.on_showcase}</span>
        <h5>{proposal.title}</h5>
        <p>{proposal.description}</p>
      </article>
    {:else}
      <p class="note">{t.showcaseEmpty}</p>
    {/if}
  </section>
</div>

<style>
  .stage {
    display: grid;
    gap: var(--space-3);
  }

  .exports {
    display: grid;
    gap: var(--space-2);
    margin: 0;
    padding: 0 0 0 var(--space-4);
    border-left: 3px solid var(--line-agents);
    list-style: none;
  }

  .exports li {
    position: relative;
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    gap: var(--space-2) var(--space-3);
  }

  /* Отвод от общей линии к агенту */
  .exports li::before {
    content: '';
    position: absolute;
    top: 22px;
    left: calc(-1 * var(--space-4));
    width: var(--space-4);
    height: 3px;
    margin-top: -1.5px;
    background: var(--line-agents);
  }

  .node {
    width: min(100%, 14rem);
  }

  .queue {
    display: grid;
    gap: var(--space-1);
    color: var(--muted);
    font-size: var(--fs-14);
  }

  input,
  button {
    min-height: 44px;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    background: var(--paper);
    color: var(--ink);
    font: inherit;
  }

  input {
    width: 8rem;
    padding: 0 var(--space-2);
    font-family: var(--font-mono);
  }

  button {
    padding: 0 var(--space-4);
    font-weight: 600;
    cursor: pointer;
  }

  button:hover:not(:disabled) {
    border-color: var(--muted);
  }

  button:disabled {
    color: var(--muted);
    cursor: not-allowed;
  }

  .note {
    color: var(--muted);
    font-size: var(--fs-14);
  }

  .showcase {
    display: grid;
    gap: var(--space-2);
  }

  h4 {
    font-size: var(--fs-14);
    font-weight: 600;
    color: var(--muted);
  }

  .card {
    display: grid;
    justify-items: start;
    gap: var(--space-2);
    max-width: 28rem;
    padding: var(--space-4);
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    background: var(--paper);
  }

  .badge {
    padding: 0.1rem var(--space-2);
    border: 2px solid var(--line-agents);
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 600;
  }

  h5 {
    font-family: var(--font-display);
    font-size: var(--fs-22);
    font-weight: 700;
  }

  .card p {
    display: -webkit-box;
    overflow: hidden;
    color: var(--muted);
    font-size: var(--fs-14);
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    line-clamp: 3;
  }
</style>
