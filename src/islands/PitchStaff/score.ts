// Модель нотного стана — порт Score Editor (github.com/MakarON-228/Note_redactor), SPEC.md §7.9:
// координаты и зажимы из `src/view/StaffWidget.cpp`, высота ноты из `src/model/Note.cpp`,
// расстановка записанных нот из `StaffWidget::addNoteFromMidi`, дебаунс из `src/audio/AudioRecorder.cpp`.
// Отличия от десктопа: штиль по правилам гравировки, стан фиксированного размера (два ряда), ноты вне шагов −6…14
// при записи пропускаются — иначе залезут на соседний стан.

import { PitchDetector } from './yin';

// Константы `StaffWidget.cpp` (при spacingK = 0)
export const STAFF_FIRST_TOP_Y = 90;
export const STAFF_LEFT_MARGIN = 70;
export const LINE_SPACING = 16;
export const HALF_STEP_PX = LINE_SPACING / 2;
export const STAFF_LINES = 5;
export const STAFF_ROW_PITCH = 175;
export const SLOT_WIDTH = 28;
export const NOTE_WIDTH = 24;
export const NOTE_HEIGHT = 12;
export const STAFF_TOP_STEP = (STAFF_LINES - 1) * 2; // 8
export const CLEF_SLOT = 0;
export const CLEF_STEP = 3;
export const RIGHT_STAFF_BORDER = 50;
export const LEDGER_BORDER = 6;
export const LEDGER_HALF = 13;
/** Рамка четвертной: 24 × 60, головка на 0.85 высоты. */
export const QUARTER_RECT_H = 60;
export const QUARTER_Y_FACTOR = 0.85;

// Размер стана на сайте
export const WIDTH = 860;
export const HEIGHT = 400;
export const ROWS = 2;

export const MIN_STEP = -LEDGER_BORDER;
export const MAX_STEP = STAFF_TOP_STEP + LEDGER_BORDER;
/** Первый слот после ключа. */
export const FIRST_SLOT = CLEF_SLOT + 1;

/** `std::lround`: половина — от нуля. */
const lround = (x: number) => Math.sign(x) * Math.round(Math.abs(x));
/** Координаты мыши в C++ приходят в `int`-параметры — дробная часть отбрасывается. */
const int = Math.trunc;
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

export const slotToX = (slot: number) => STAFF_LEFT_MARGIN + slot * SLOT_WIDTH;
export const xToSlot = (x: number) => Math.max(0, lround((int(x) - STAFF_LEFT_MARGIN) / SLOT_WIDTH));
export const staffTopY = (staff: number) => STAFF_FIRST_TOP_Y + staff * STAFF_ROW_PITCH;
export const staffBottomY = (staff: number) => staffTopY(staff) + (STAFF_LINES - 1) * LINE_SPACING;
export const staffStepToY = (staff: number, step: number) => staffBottomY(staff) - step * HALF_STEP_PX;

export function yToStaffIndex(y: number, staffCount = ROWS): number {
  if (staffCount <= 1) return 0;
  const staffCenterY0 = STAFF_FIRST_TOP_Y + 2 * LINE_SPACING;
  return clamp(lround((int(y) - staffCenterY0) / STAFF_ROW_PITCH), 0, staffCount - 1);
}

export const yToStaffStep = (staff: number, y: number) => lround((staffBottomY(staff) - int(y)) / HALF_STEP_PX);

/** Правый край, до которого ставятся ноты: `xToSlot(width() − kRightStaffBorder)`. */
export const MAX_SLOT = xToSlot(WIDTH - RIGHT_STAFF_BORDER);

// Высота ноты — `Note::updatePitchFromStaffStep`: шаг 0 — нижняя линия, E4.
const BOTTOM_LINE_DIATONIC_FROM_C0 = 30;
const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
const SEMITONE_FROM_C = [0, 2, 4, 5, 7, 9, 11] as const;

export interface Pitch {
  letter: (typeof LETTERS)[number];
  octave: number;
  midi: number;
}

export function stepToPitch(step: number): Pitch {
  const diatonic = BOTTOM_LINE_DIATONIC_FROM_C0 + step;
  const octave = Math.floor(diatonic / 7);
  const index = diatonic - octave * 7;
  return { letter: LETTERS[index]!, octave, midi: (octave + 1) * 12 + SEMITONE_FROM_C[index]! };
}

export const noteName = (step: number) => {
  const p = stepToPitch(step);
  return `${p.letter}${p.octave}`;
};

const CHROMATIC = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'] as const;

/** Имя MIDI-ноты для живого индикатора: «A4», «C♯5». */
export const midiName = (midi: number) => `${CHROMATIC[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;

/** Правило гравировки: на средней линии (B4) и выше штиль вниз, слева от головки. */
export const stemDown = (step: number) => step >= STAFF_TOP_STEP / 2;

/** Шаги добавочных линий — `drawLedgerLinesForStep`. */
export function ledgerSteps(step: number): number[] {
  const out: number[] = [];
  if (step > STAFF_TOP_STEP) for (let s = STAFF_TOP_STEP + 2; s <= step; s += 2) out.push(s);
  else if (step < 0) for (let s = -2; s >= step; s -= 2) out.push(s);
  return out;
}

// Партитура

/** `quarter` — поставлена кликом; `undefined` — записана с микрофона: высота есть, длительности нет. */
export type Duration = 'quarter' | 'undefined';

export interface StaffNote {
  id: number;
  slot: number;
  staff: number;
  step: number;
  duration: Duration;
}

export interface Position {
  slot: number;
  staff: number;
  step: number;
}

/** Куда попадает клик: слот и шаг округлены и зажаты, как в `mousePressEvent`; `rawSlot` — для поиска попадания. */
export function positionAt(x: number, y: number): Position & { rawSlot: number } {
  const rawSlot = xToSlot(x);
  const staff = yToStaffIndex(y);
  return {
    rawSlot,
    slot: clamp(rawSlot, FIRST_SLOT, MAX_SLOT),
    staff,
    step: clamp(yToStaffStep(staff, y), MIN_STEP, MAX_STEP),
  };
}

/** `Score::noteAt`: от новых к старым, допуск по слоту и шагу. */
export function noteAt(notes: readonly StaffNote[], slot: number, staff: number, step: number, slotTolerance = 0, stepTolerance = 1): StaffNote | undefined {
  for (let i = notes.length - 1; i >= 0; i--) {
    const n = notes[i]!;
    if (Math.abs(n.slot - slot) <= slotTolerance && n.staff === staff && Math.abs(n.step - step) <= stepTolerance) return n;
  }
  return undefined;
}

export type Edit = { kind: 'added'; note: StaffNote; notes: StaffNote[] } | { kind: 'removed'; note: StaffNote; notes: StaffNote[] };

let nextId = 1;
const newNote = (pos: Position, duration: Duration): StaffNote => ({ id: nextId++, ...pos, duration });

/** Клик по ноте убирает её (как ластик десктопа), по пустому месту — ставит четвертную. */
export function toggleAt(notes: readonly StaffNote[], pos: Position, hitSlot = pos.slot): Edit {
  const hit = noteAt(notes, hitSlot, pos.staff, pos.step);
  if (hit) return { kind: 'removed', note: hit, notes: notes.filter((n) => n !== hit) };
  const note = newNote(pos, 'quarter');
  return { kind: 'added', note, notes: [...notes, note] };
}

// Запись — `addNoteFromMidi`

/** Шаг для MIDI-ноты; `null` — диез/бемоль: десктоп их пропускает. */
export function midiToStep(midi: number): number | null {
  const octave = Math.floor(midi / 12) - 1;
  const base = (SEMITONE_FROM_C as readonly number[]).indexOf(midi - (octave + 1) * 12);
  if (base < 0) return null;
  return base + (octave - 4) * 7 - 2;
}

/** Свободное место справа: через слот после самой правой ноты последнего занятого стана; `null` — места нет. */
export function nextFreeSlot(notes: readonly StaffNote[]): { slot: number; staff: number } | null {
  let staff = 0;
  for (const n of notes) staff = Math.max(staff, n.staff);
  let maxSlot = 0;
  for (const n of notes) if (n.staff === staff) maxSlot = Math.max(maxSlot, n.slot);

  let slot = maxSlot + 2;
  if (slotToX(slot) > WIDTH - RIGHT_STAFF_BORDER) {
    slot = 4;
    staff++;
    if (staff >= ROWS) return null;
  }
  return { slot, staff };
}

export type Recorded =
  | { kind: 'added'; note: StaffNote; notes: StaffNote[] }
  | { kind: 'accidental' | 'range' | 'full'; midi: number };

export function recordMidi(notes: readonly StaffNote[], midi: number): Recorded {
  const step = midiToStep(midi);
  if (step === null) return { kind: 'accidental', midi };
  if (step < MIN_STEP || step > MAX_STEP) return { kind: 'range', midi };
  const place = nextFreeSlot(notes);
  if (!place) return { kind: 'full', midi };
  const note = newNote({ ...place, step }, 'undefined');
  return { kind: 'added', note, notes: [...notes, note] };
}

/** `AudioRecorder::processAudioData`: нота засчитывается на третьем одинаковом кадре подряд, один раз. */
export class NoteDebouncer {
  private lastDetectedNote = -1;
  private consecutiveDetections = 0;

  /** Частота кадра (0 — высоты нет) → MIDI-нота, если её пора поставить. */
  push(frequency: number): number | null {
    if (frequency > 0) {
      const midiNote = PitchDetector.frequencyToMidiNote(frequency);
      if (midiNote === this.lastDetectedNote) {
        this.consecutiveDetections++;
        if (this.consecutiveDetections === 3) return midiNote;
      } else {
        this.lastDetectedNote = midiNote;
        this.consecutiveDetections = 1;
      }
    } else {
      this.lastDetectedNote = -1;
      this.consecutiveDetections = 0;
    }
    return null;
  }

  reset(): void {
    this.lastDetectedNote = -1;
    this.consecutiveDetections = 0;
  }
}

// Курсор клавиатуры — `moveSelectedNote*`: ←/→ по слотам с переходом между станами, ↑/↓ по шагам.

export function moveCursor(pos: Position, key: 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown'): Position {
  switch (key) {
    case 'ArrowUp':
      return { ...pos, step: Math.min(pos.step + 1, MAX_STEP) };
    case 'ArrowDown':
      return { ...pos, step: Math.max(pos.step - 1, MIN_STEP) };
    case 'ArrowRight':
      if (pos.slot < MAX_SLOT) return { ...pos, slot: pos.slot + 1 };
      return pos.staff < ROWS - 1 ? { ...pos, staff: pos.staff + 1, slot: FIRST_SLOT } : pos;
    case 'ArrowLeft':
      if (pos.slot > FIRST_SLOT) return { ...pos, slot: pos.slot - 1 };
      return pos.staff > 0 ? { ...pos, staff: pos.staff - 1, slot: MAX_SLOT } : pos;
  }
}
