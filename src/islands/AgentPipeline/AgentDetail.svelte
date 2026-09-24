<script lang="ts">
  // Подробности выбранного агента: роль и таймаут из кода, что он читает (лимит compact_text и сколько символов пришло
  // в этом запуске), что платформа разобрала из ответа и сам ответ — симуляция.
  import type { Agent } from '../../data/demo/yandex-agents';
  import { ui } from '../../data/resume';
  import { agentById, type AgentState, type Input } from './run';

  interface Props {
    agent: Agent | null;
    state: AgentState;
    inputs: Input[];
    parsed: string | null;
    answer: string;
  }

  let { agent, state, inputs, parsed, answer }: Props = $props();
  const t = ui.agentPipeline;
  const ran = $derived(state === 'running' || state === 'done');
</script>

<section class="detail" aria-label={agent?.title ?? t.pick}>
  {#if !agent}
    <p class="hint">{t.pick}</p>
  {:else}
    <h4>
      {agent.title}
      <span class="timeout">{t.timeout(agent.timeoutSec)}</span>
    </h4>
    <p>{agent.role}</p>
    <dl>
      <dt>{t.reads}</dt>
      <dd>
        {#if inputs.length}
          <ul>
            {#each inputs as input (input.from)}
              <li>
                {agentById.get(input.from)!.title} —
                <span class="num">
                  {#if input.limit === null}{t.inFull}{:else if ran}{t.got(input.chars, input.limit)}{:else}{t.upTo(input.limit)}{/if}
                </span>
                {#if ran && input.truncated}<span class="cut">({t.cut})</span>{/if}
              </li>
            {/each}
          </ul>
        {:else}
          {agent.group === 'export' ? t.readsResult : t.readsProposal}
        {/if}
      </dd>
      {#if parsed && state === 'done'}
        <dt>{t.parsed}</dt>
        <dd class="num">{parsed}</dd>
      {/if}
    </dl>
    <h5>{t.answer}</h5>
    {#if state === 'done'}
      <pre tabindex="0" role="region" aria-label={`${agent.title}: ${t.answer}`}>{answer}</pre>
    {:else}
      <p class="hint">{state === 'running' ? t.running : t.notRun}</p>
    {/if}
  {/if}
</section>

<style>
  .detail {
    display: grid;
    gap: var(--space-2);
    padding: var(--space-3);
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    background: var(--paper);
    font-size: var(--fs-14);
  }

  h4 {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--space-1) var(--space-3);
    font-family: var(--font-display);
    font-size: var(--fs-22);
    font-weight: 700;
  }

  .timeout,
  .hint,
  dt,
  h5,
  .cut {
    color: var(--muted);
  }

  .timeout {
    font-family: var(--font-mono);
    font-size: var(--fs-14);
    font-weight: 400;
  }

  dl {
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr);
    gap: var(--space-1) var(--space-3);
    margin: 0;
  }

  dd {
    margin: 0;
  }

  dd ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .num {
    font-variant-numeric: tabular-nums;
  }

  h5 {
    font-size: var(--fs-14);
    font-weight: 600;
  }

  pre {
    max-height: 16rem;
    overflow: auto;
    margin: 0;
    padding: var(--space-2) var(--space-3);
    border-left: 3px solid var(--line-agents);
    background: var(--surface);
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    line-height: 1.5;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  @media (max-width: 479px) {
    dl {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
