<script lang="ts">
  // Линия статусов проекта (линия Agents): семь станций enum ProjectStatus и два ответвления от проверки — возврат
  // на доработку и отказ. Пройденные станции и перегоны залиты; на узком блоке линия идёт сверху вниз.
  import { BRANCHES, MAIN_LINE, type ProjectStatus } from './status';

  interface Props {
    status: ProjectStatus;
    labels: Record<ProjectStatus, string>;
    label: string;
  }

  let { status, labels, label }: Props = $props();

  const at = $derived(BRANCHES.includes(status) ? MAIN_LINE.indexOf('under_review') : MAIN_LINE.indexOf(status));
</script>

<div class="wrap">
  <ol class="line" aria-label={label}>
    {#each MAIN_LINE as s, i (s)}
      <li class:reached={i <= at} class:passed={i < at} class:here={s === status} aria-current={s === status ? 'step' : undefined}>
        <span class="dot" aria-hidden="true"></span>
        <span class="label">{labels[s]}</span>
        {#if s === 'under_review'}
          <ul class="branches">
            {#each BRANCHES as b (b)}
              <li class={b} class:here={b === status} aria-current={b === status ? 'step' : undefined}>
                <span class="dot" aria-hidden="true"></span>{labels[b]}
              </li>
            {/each}
          </ul>
        {/if}
      </li>
    {/each}
  </ol>
</div>

<style>
  .wrap {
    container: status / inline-size;
  }

  .line {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: 0.8125rem;
    line-height: 1.25;
  }

  .line > li {
    position: relative;
    display: grid;
    justify-items: center;
    align-content: start;
    gap: var(--space-1);
    padding: 0 2px;
    text-align: center;
    color: var(--muted);
  }

  /* Перегон до следующей станции — от центра этой до центра следующей */
  .line > li:not(:last-child)::before {
    content: '';
    position: absolute;
    top: 6px;
    left: 50%;
    width: 100%;
    height: 3px;
    background: var(--rule);
  }

  .line > li.passed::before {
    background: var(--line-agents);
  }

  .dot {
    position: relative;
    z-index: 1;
    width: 15px;
    height: 15px;
    border: 3px solid var(--rule);
    border-radius: 50%;
    background: var(--surface);
  }

  .reached > .dot {
    border-color: var(--line-agents);
  }

  .passed > .dot {
    background: var(--line-agents);
  }

  .here > .dot {
    background: var(--line-agents);
    box-shadow:
      0 0 0 2px var(--surface),
      0 0 0 4px var(--ink);
  }

  .here > .label,
  .branches .here {
    color: var(--ink);
    font-weight: 600;
  }

  .branches {
    display: grid;
    gap: var(--space-1);
    margin: var(--space-1) 0 0;
    padding: 0;
    list-style: none;
    text-align: left;
    font-size: 0.75rem;
  }

  .branches li {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }

  .branches .dot {
    width: 11px;
    height: 11px;
    border-width: 2px;
  }

  .branches .here .dot {
    box-shadow:
      0 0 0 2px var(--surface),
      0 0 0 3.5px var(--ink);
  }

  .branches .revision_requested.here .dot {
    border-color: var(--line-craft);
    background: var(--line-craft);
  }

  .branches .rejected.here .dot {
    border-color: var(--line-rail);
    background: var(--line-rail);
  }

  @container status (max-width: 559px) {
    .line {
      grid-template-columns: minmax(0, 1fr);
    }

    .line > li {
      grid-template-columns: 15px minmax(0, 1fr);
      justify-items: start;
      column-gap: var(--space-2);
      padding: 0 0 var(--space-2);
      text-align: left;
    }

    .line > li:not(:last-child)::before {
      top: 6px;
      bottom: -6px;
      left: 6px;
      width: 3px;
      height: auto;
    }

    .branches {
      grid-column: 2;
      margin: 0;
    }
  }
</style>
