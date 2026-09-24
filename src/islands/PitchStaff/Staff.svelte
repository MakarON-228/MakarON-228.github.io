<script lang="ts">
  // Нотный стан (SPEC.md §7.9): отрисовка по геометрии StaffWidget и ввод — клик, наведение, клавиатура.
  // Координаты указателя переводятся в логические единицы стана (860 × 400), дальше работает порт из score.ts.
  import { quarterNote, trebleClef } from './glyphs';
  import {
    CLEF_SLOT,
    CLEF_STEP,
    HEIGHT,
    LEDGER_HALF,
    LINE_SPACING,
    NOTE_WIDTH,
    QUARTER_RECT_H,
    QUARTER_Y_FACTOR,
    ROWS,
    STAFF_LEFT_MARGIN,
    STAFF_LINES,
    WIDTH,
    ledgerSteps,
    moveCursor,
    noteAt,
    positionAt,
    slotToX,
    staffStepToY,
    staffTopY,
    stemDown,
    type Position,
    type StaffNote,
  } from './score';

  interface Props {
    notes: readonly StaffNote[];
    cursor: Position;
    label: string;
    description: string;
    onplace: (pos: Position, hitSlot: number) => void;
    onremove: (pos: Position) => void;
    oncursor: (pos: Position) => void;
    onundo: () => void;
  }

  let { notes, cursor, label, description, onplace, onremove, oncursor, onundo }: Props = $props();

  const uid = $props.id();
  const [, , qW, qH] = quarterNote.viewBox.split(' ').map(Number) as [number, number, number, number];
  // Центр головки относительно точки ноты: головка стоит на линии, поворот на 180° вокруг неё даёт штиль вниз слева.
  const headDx = (quarterNote.headCenter.x / qW) * NOTE_WIDTH - NOTE_WIDTH / 2;
  const headDy = QUARTER_RECT_H * (quarterNote.headCenter.y / qH - QUARTER_Y_FACTOR);
  const staves = Array.from({ length: ROWS }, (_, i) => i);
  const lines = Array.from({ length: STAFF_LINES }, (_, i) => i);

  let scroller: HTMLElement;
  let svg: SVGSVGElement;
  let hover = $state<{ pos: Position; raw: number } | null>(null);
  let focused = $state(false);
  let keyboard = $state(false);

  // Что показать под указателем: призрак новой ноты или подсветку ноты, которую клик уберёт.
  const target = $derived(keyboard && focused ? { pos: cursor, raw: cursor.slot } : hover);
  const hit = $derived(target ? noteAt(notes, target.raw, target.pos.staff, target.pos.step) : undefined);
  const ghost = $derived(target && !hit ? target.pos : null);

  function toLogical(e: MouseEvent) {
    const r = svg.getBoundingClientRect();
    return positionAt(((e.clientX - r.left) * WIDTH) / r.width, ((e.clientY - r.top) * HEIGHT) / r.height);
  }

  /** Прокрутить стан так, чтобы слот был виден (на узком экране стан шире блока). */
  export function reveal(pos: Position) {
    const scale = svg.clientWidth / WIDTH;
    const x = slotToX(pos.slot) * scale;
    const pad = 2 * NOTE_WIDTH * scale;
    if (x - pad < scroller.scrollLeft) scroller.scrollLeft = x - pad;
    else if (x + pad > scroller.scrollLeft + scroller.clientWidth) scroller.scrollLeft = x + pad - scroller.clientWidth;
  }

  function onclick(e: MouseEvent) {
    const p = toLogical(e);
    const { rawSlot, ...pos } = p;
    onplace(pos, rawSlot);
  }

  function onpointermove(e: PointerEvent) {
    if (e.pointerType !== 'mouse') return;
    keyboard = false;
    const { rawSlot, ...pos } = toLogical(e);
    hover = { pos, raw: rawSlot };
  }

  function onkeydown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      onundo();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const next = moveCursor(cursor, e.key);
      oncursor(next);
      reveal(next);
    } else if (e.key === 'Enter' || e.key === ' ' || e.key === '3') {
      onplace(cursor, cursor.slot);
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      onremove(cursor);
    } else {
      return;
    }
    keyboard = true;
    e.preventDefault();
  }
</script>

{#snippet ledgers(x: number, staff: number, step: number, cls: string)}
  {#each ledgerSteps(step) as s (s)}
    <line class={cls} x1={x - LEDGER_HALF} x2={x + LEDGER_HALF} y1={staffStepToY(staff, s)} y2={staffStepToY(staff, s)} />
  {/each}
{/snippet}

{#snippet quarter(pos: Position, cls: string)}
  {@const x = slotToX(pos.slot)}
  {@const y = staffStepToY(pos.staff, pos.step)}
  {@render ledgers(x, pos.staff, pos.step, cls)}
  <use
    class={cls}
    href="#{uid}-q"
    x={x - NOTE_WIDTH / 2}
    y={y - QUARTER_RECT_H * QUARTER_Y_FACTOR}
    width={NOTE_WIDTH}
    height={QUARTER_RECT_H}
    transform={stemDown(pos.step) ? `rotate(180 ${x + headDx} ${y + headDy})` : undefined}
  />
{/snippet}

<div
  class="scroller"
  bind:this={scroller}
  role="application"
  tabindex="0"
  aria-label={label}
  aria-describedby="{uid}-desc"
  {onkeydown}
  onfocus={() => (focused = true)}
  onblur={() => (focused = false)}
  onpointerdown={() => (keyboard = false)}
>
  <svg
    bind:this={svg}
    viewBox="0 0 {WIDTH} {HEIGHT}"
    aria-hidden="true"
    focusable="false"
    {onclick}
    {onpointermove}
    onpointerleave={() => (hover = null)}
  >
    <defs>
      <symbol id="{uid}-clef" viewBox={trebleClef.viewBox} preserveAspectRatio="none">
        <path transform={trebleClef.transform} d={trebleClef.d} />
      </symbol>
      <symbol id="{uid}-q" viewBox={quarterNote.viewBox} preserveAspectRatio="none">
        <g transform={quarterNote.transform}>
          <path d={quarterNote.head} fill-rule="evenodd" />
          <path d={quarterNote.stem} />
        </g>
      </symbol>
    </defs>

    {#each staves as staff (staff)}
      {#each lines as line (line)}
        {@const y = staffTopY(staff) + line * LINE_SPACING}
        <line class="staff-line" x1={STAFF_LEFT_MARGIN - 40} x2={WIDTH - 30} y1={y} y2={y} />
      {/each}
      <use href="#{uid}-clef" x={slotToX(CLEF_SLOT) - 12} y={staffStepToY(staff, CLEF_STEP) - 46} width="24" height="92" />
    {/each}

    {#each notes as note (note.id)}
      {@const cls = note === hit ? 'hit' : ''}
      {#if note.duration === 'quarter'}
        {@render quarter(note, cls)}
      {:else}
        {@const x = slotToX(note.slot)}
        {@render ledgers(x, note.staff, note.step, cls)}
        <ellipse class="recorded {cls}" cx={x} cy={staffStepToY(note.staff, note.step)} rx="10" ry="5" />
      {/if}
    {/each}

    {#if ghost}
      {@render quarter(ghost, 'ghost')}
    {/if}
  </svg>
</div>
<p class="visually-hidden" id="{uid}-desc">{description}</p>

<style>
  .scroller {
    overflow-x: auto;
    overscroll-behavior-x: contain;
    background: var(--paper);
    border: 1px solid var(--rule);
    border-radius: var(--radius);
  }

  svg {
    width: 100%;
    min-width: 560px;
    height: auto;
    aspect-ratio: 860 / 400;
    color: var(--ink);
    fill: currentColor;
    cursor: pointer;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }

  line {
    stroke: currentColor;
    stroke-width: 2;
  }

  .recorded {
    fill: var(--line-craft);
    stroke: var(--ink);
    stroke-width: 1.5;
  }

  /* Клик уберёт эту ноту */
  .hit {
    color: var(--line-rail);
  }

  .recorded.hit {
    fill: var(--line-rail);
  }

  .ghost {
    color: var(--line-science);
    opacity: 0.55;
  }
</style>
