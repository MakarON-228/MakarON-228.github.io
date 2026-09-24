<script lang="ts">
  // Агент — станция: кружок показывает состояние (пустой — не запускался или ждёт, заливка — готов, пульс — работает),
  // клик выбирает агента для панели подробностей. card — в панели оценки и экспорта, column — в цепочке deep research
  // (кружок над подписью; на узком экране — слева от неё).
  import type { Agent } from '../../data/demo/yandex-agents';
  import type { AgentState } from './run';

  interface Props {
    agent: Agent;
    state: AgentState;
    stateLabel: string;
    selected: boolean;
    layout: 'card' | 'column';
    onselect: (id: string) => void;
  }

  let { agent, state, stateLabel, selected, layout, onselect }: Props = $props();
</script>

<button type="button" class="node {layout} {state}" aria-pressed={selected} onclick={() => onselect(agent.id)}>
  <span class="dot" aria-hidden="true"></span>
  <span class="name">{agent.title}</span>
  <span class="visually-hidden">, {stateLabel}</span>
</button>

<style>
  .node {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    width: 100%;
    min-height: 44px;
    padding: var(--space-1) var(--space-3);
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    background: var(--paper);
    color: var(--ink);
    font: inherit;
    font-size: var(--fs-14);
    text-align: left;
    cursor: pointer;
  }

  .node:hover {
    border-color: var(--muted);
  }

  .node[aria-pressed='true'] {
    border-color: var(--ink);
    box-shadow: inset 0 0 0 1px var(--ink);
  }

  .node[aria-pressed='true'] .name {
    font-weight: 600;
  }

  .dot {
    position: relative;
    flex: none;
    width: 14px;
    height: 14px;
    border: 2.5px solid var(--muted);
    border-radius: 50%;
    background: var(--surface);
  }

  .waiting .dot {
    border-color: var(--line-agents);
  }

  .running .dot,
  .done .dot {
    border-color: var(--line-agents);
    background: var(--line-agents);
  }

  .running .dot::after {
    content: '';
    position: absolute;
    inset: -6px;
    border: 2px solid var(--line-agents);
    border-radius: 50%;
    animation: pulse 1s ease-out infinite;
  }

  @keyframes pulse {
    from {
      opacity: 0.9;
      transform: scale(0.6);
    }
    to {
      opacity: 0;
      transform: scale(1.3);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .running .dot::after {
      animation: none;
      opacity: 0.6;
    }
  }

  .name {
    line-height: 1.2;
  }

  /* Станция цепочки: без рамки, кружок на линии, подпись под ним */
  .column {
    flex-direction: column;
    justify-content: flex-start;
    gap: var(--space-1);
    height: 100%;
    padding: 0 2px var(--space-1);
    border-color: transparent;
    background: none;
    text-align: center;
  }

  .column .name {
    font-size: 0.8125rem;
    overflow-wrap: anywhere;
  }

  @container chain (max-width: 559px) {
    .column {
      flex-direction: row;
      padding: 0 var(--space-2) 0 0;
      text-align: left;
    }
  }
</style>
