<script lang="ts">
  // Остров PitchStaff (SPEC.md §7.9): нотный стан Score Editor — четвертные по клику в слоты и запись с микрофона,
  // где YIN ставит ноты на свободное место справа. Микрофон — только по нажатию; уходит с экрана — выключается.
  import { onMount } from 'svelte';
  import { ui } from '../../data/resume';
  import { startMic, type Mic, type MicError } from './mic';
  import {
    FIRST_SLOT,
    MAX_STEP,
    MIN_STEP,
    NoteDebouncer,
    midiName,
    midiToStep,
    nextFreeSlot,
    noteAt,
    noteName,
    recordMidi,
    toggleAt,
    type Position,
    type StaffNote,
  } from './score';
  import Staff from './Staff.svelte';
  import { PitchDetector } from './yin';

  const t = ui.pitchStaff;

  let notes = $state.raw<StaffNote[]>([]);
  let history = $state.raw<StaffNote[][]>([]);
  // Как в десктопе: курсор сначала в первом слоте после ключа, на средней линии.
  let cursor = $state<Position>({ slot: FIRST_SLOT, staff: 0, step: 4 });
  let rec = $state<'idle' | 'starting' | 'on'>('idle');
  let live = $state<{ hz: number; midi: number } | null>(null);
  let announcement = $state('');

  let root: HTMLElement;
  let staff: ReturnType<typeof Staff> | undefined = $state();
  let mic: Mic | null = null;
  let session = 0;
  const debouncer = new NoteDebouncer();

  const where = (p: Position) => t.position(noteName(p.step), p.staff + 1, p.slot);
  const ordered = $derived([...notes].sort((a, b) => a.staff - b.staff || a.slot - b.slot));
  const description = $derived(`${t.keys} ${t.summary(ordered.map((n) => noteName(n.step)))}`);

  // Видимая строка: во время записи — частота и нота текущего кадра, иначе — последнее действие (то же, что для
  // скринридера).
  const status = $derived.by(() => {
    if (rec === 'starting') return t.starting;
    if (rec === 'idle') return announcement;
    if (!live) return t.listening;
    const reading = `${t.hz(live.hz)} · ${midiName(live.midi)}`;
    const step = midiToStep(live.midi);
    if (step === null) return `${reading} — ${t.skipped}`;
    if (step < MIN_STEP || step > MAX_STEP) return `${reading} — ${t.outside}`;
    return reading;
  });

  function commit(next: StaffNote[]) {
    history = [...history, notes];
    notes = next;
  }

  function place(pos: Position, hitSlot: number) {
    cursor = pos;
    const edit = toggleAt(notes, pos, hitSlot);
    commit(edit.notes);
    announcement = edit.kind === 'added' ? t.placed(where(edit.note)) : t.removed(where(edit.note));
  }

  function remove(pos: Position) {
    const hit = noteAt(notes, pos.slot, pos.staff, pos.step);
    if (!hit) return;
    commit(notes.filter((n) => n !== hit));
    announcement = t.removed(where(hit));
  }

  function moveTo(pos: Position) {
    cursor = pos;
    announcement = where(pos);
  }

  function undo() {
    const prev = history.at(-1);
    if (!prev) return;
    history = history.slice(0, -1);
    notes = prev;
    announcement = t.undone;
  }

  function clear() {
    if (!notes.length) return;
    commit([]);
    announcement = t.cleared;
  }

  function onFrequency(hz: number) {
    live = hz > 0 ? { hz, midi: PitchDetector.frequencyToMidiNote(hz) } : null;
    const midi = debouncer.push(hz);
    if (midi === null) return;
    const r = recordMidi(notes, midi);
    if (r.kind === 'added') {
      commit(r.notes);
      announcement = t.recorded(where(r.note));
      staff?.reveal(r.note);
    } else if (r.kind === 'full') {
      stopRecording();
      announcement = t.full;
    }
  }

  async function startRecording() {
    // Места нет — микрофон незачем и спрашивать.
    if (!nextFreeSlot(notes)) {
      announcement = t.full;
      return;
    }
    const id = ++session;
    rec = 'starting';
    debouncer.reset();
    try {
      const started = await startMic(onFrequency);
      if (id !== session) return started.stop();
      mic = started;
      rec = 'on';
      announcement = t.recordingOn;
    } catch (err) {
      if (id !== session) return;
      rec = 'idle';
      announcement = typeof err === 'string' && err in t.errors ? t.errors[err as MicError] : t.errors.failed;
    }
  }

  function stopRecording(announce = false) {
    session++;
    mic?.stop();
    mic = null;
    live = null;
    if (announce && rec !== 'idle') announcement = t.recordingOff;
    rec = 'idle';
  }

  onMount(() => {
    // Микрофон не остаётся включённым, когда демо не видно: блок ушёл с экрана или вкладка скрыта.
    const io = new IntersectionObserver(([entry]) => {
      if (entry && !entry.isIntersecting) stopRecording(true);
    });
    io.observe(root);
    const onVisibility = () => {
      if (document.hidden) stopRecording(true);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      stopRecording();
    };
  });
</script>

<div class="app" bind:this={root}>
  <div class="controls">
    <button type="button" class="rec" class:on={rec !== 'idle'} onclick={() => (rec === 'idle' ? startRecording() : stopRecording(true))}>
      <span class="dot" aria-hidden="true"></span>{rec === 'idle' ? t.record : t.stop}
    </button>
    <button type="button" onclick={undo} disabled={!history.length}>{t.undo}</button>
    <button type="button" onclick={clear} disabled={!notes.length}>{t.clear}</button>
  </div>

  <Staff bind:this={staff} {notes} {cursor} label={t.staffLabel} {description} onplace={place} onremove={remove} oncursor={moveTo} onundo={undo} />

  <p class="status" class:reading={rec === 'on' && live !== null}>{status}</p>
  <p class="hint">
    {t.hint}
    <span class="legend"><span class="swatch" aria-hidden="true"></span>{t.legendRecorded}</span>
  </p>
  <p class="visually-hidden" aria-live="polite">{announcement}</p>
</div>

<style>
  .app {
    display: grid;
    gap: var(--space-3);
    min-width: 0;
  }

  .controls {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  button {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 44px;
    padding: 0 var(--space-4);
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    background: var(--paper);
    color: var(--ink);
    font-weight: 600;
    cursor: pointer;
  }

  button:hover:not(:disabled) {
    border-color: var(--muted);
  }

  button:disabled {
    color: var(--muted);
    cursor: default;
  }

  .dot {
    width: 0.75rem;
    height: 0.75rem;
    border-radius: 50%;
    background: var(--line-rail);
  }

  .rec.on {
    background: var(--ink);
    border-color: var(--ink);
    color: var(--paper);
  }

  /* Строка есть всегда, даже пустая: частота и действия в одну строку не сдвигают вёрстку */
  .status {
    min-height: calc(var(--lh-body) * 1em);
    font-size: var(--fs-14);
    color: var(--muted);
  }

  .status.reading {
    color: var(--ink);
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
  }

  .hint {
    font-size: var(--fs-14);
  }

  .legend {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    margin-left: var(--space-2);
    color: var(--muted);
    white-space: nowrap;
  }

  .swatch {
    width: 20px;
    height: 10px;
    border-radius: 50%;
    background: var(--line-craft);
    border: 1.5px solid var(--ink);
  }

  @media (max-width: 479px) {
    button {
      padding: 0 var(--space-3);
    }
  }
</style>
