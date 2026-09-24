import { describe, expect, it } from 'vitest';
import {
  MAX_SLOT,
  NoteDebouncer,
  ledgerSteps,
  midiName,
  midiToStep,
  moveCursor,
  nextFreeSlot,
  noteName,
  positionAt,
  recordMidi,
  slotToX,
  staffBottomY,
  staffStepToY,
  staffTopY,
  stemDown,
  stepToPitch,
  toggleAt,
  xToSlot,
  yToStaffIndex,
  yToStaffStep,
  type StaffNote,
} from './score';

const note = (slot: number, staff: number, step = 4): StaffNote => ({ id: slot * 100 + staff, slot, staff, step, duration: 'quarter' });

describe('staff geometry (StaffWidget.cpp)', () => {
  it('maps slots to x and back with lround', () => {
    expect(slotToX(0)).toBe(70);
    expect(slotToX(1)).toBe(98);
    expect(xToSlot(83.9)).toBe(0); // int(83.9) = 83 → 0.46
    expect(xToSlot(84)).toBe(1); // 0.5 → от нуля
    expect(xToSlot(10)).toBe(0);
    expect(MAX_SLOT).toBe(26);
  });

  it('maps steps to y and back', () => {
    expect(staffTopY(0)).toBe(90);
    expect(staffBottomY(0)).toBe(154);
    expect(staffTopY(1)).toBe(265);
    expect(staffStepToY(0, 0)).toBe(154);
    expect(staffStepToY(0, 8)).toBe(90);
    expect(staffStepToY(0, -2)).toBe(170);
    expect(yToStaffStep(0, 150)).toBe(1);
    expect(yToStaffStep(0, 158)).toBe(-1);
  });

  it('splits the two staves halfway between their centres', () => {
    expect(yToStaffIndex(209)).toBe(0);
    expect(yToStaffIndex(210)).toBe(1);
    expect(yToStaffIndex(-50)).toBe(0);
    expect(yToStaffIndex(900)).toBe(1);
  });

  it('snaps a click into the slot and step range', () => {
    expect(positionAt(0, 0)).toEqual({ rawSlot: 0, slot: 1, staff: 0, step: 14 });
    expect(positionAt(slotToX(5) + 13, staffStepToY(0, 3) - 3)).toEqual({ rawSlot: 5, slot: 5, staff: 0, step: 3 });
    expect(positionAt(slotToX(5), 401)).toEqual({ rawSlot: 5, slot: 5, staff: 1, step: -6 });
    expect(positionAt(850, 250).slot).toBe(MAX_SLOT);
  });
});

describe('pitch of a staff step (Note.cpp)', () => {
  it('counts from E4 on the bottom line', () => {
    expect(noteName(0)).toBe('E4');
    expect(noteName(-2)).toBe('C4');
    expect(noteName(3)).toBe('A4');
    expect(noteName(4)).toBe('B4');
    expect(noteName(8)).toBe('F5');
    expect(noteName(14)).toBe('E6');
    expect(noteName(-6)).toBe('F3');
    expect(stepToPitch(3).midi).toBe(69);
    expect(stepToPitch(-2).midi).toBe(60);
  });

  it('names MIDI notes with sharps for the live readout', () => {
    expect(midiName(69)).toBe('A4');
    expect(midiName(60)).toBe('C4');
    expect(midiName(73)).toBe('C♯5');
    expect(midiName(47)).toBe('B2');
  });

  it('draws ledger lines every other step outside the staff', () => {
    expect(ledgerSteps(4)).toEqual([]);
    expect(ledgerSteps(9)).toEqual([]);
    expect(ledgerSteps(10)).toEqual([10]);
    expect(ledgerSteps(14)).toEqual([10, 12, 14]);
    expect(ledgerSteps(-1)).toEqual([]);
    expect(ledgerSteps(-2)).toEqual([-2]);
    expect(ledgerSteps(-6)).toEqual([-2, -4, -6]);
  });

  it('turns stems down from the middle line up', () => {
    expect(stemDown(3)).toBe(false);
    expect(stemDown(4)).toBe(true);
    expect(stemDown(14)).toBe(true);
    expect(stemDown(-6)).toBe(false);
  });
});

describe('placing notes by click', () => {
  it('adds a quarter note, and a click on it takes it away', () => {
    const added = toggleAt([], { slot: 5, staff: 0, step: 3 });
    expect(added.kind).toBe('added');
    expect(added.note).toMatchObject({ slot: 5, staff: 0, step: 3, duration: 'quarter' });
    expect(toggleAt(added.notes, { slot: 5, staff: 0, step: 4 }).kind).toBe('removed');
    const removed = toggleAt(added.notes, { slot: 5, staff: 0, step: 3 });
    expect(removed.notes).toEqual([]);
  });

  it('adds beside a note two steps away or on the other staff', () => {
    const notes = [note(5, 0, 3)];
    expect(toggleAt(notes, { slot: 5, staff: 0, step: 5 }).kind).toBe('added');
    expect(toggleAt(notes, { slot: 5, staff: 1, step: 3 }).kind).toBe('added');
    expect(toggleAt(notes, { slot: 6, staff: 0, step: 3 }).kind).toBe('added');
  });
});

describe('recording (addNoteFromMidi, AudioRecorder)', () => {
  it('maps natural notes to steps and skips sharps', () => {
    expect(midiToStep(60)).toBe(-2);
    expect(midiToStep(69)).toBe(3);
    expect(midiToStep(72)).toBe(5);
    expect(midiToStep(84)).toBe(12);
    expect(midiToStep(61)).toBeNull();
    expect(midiToStep(70)).toBeNull();
    for (const midi of [48, 50, 52, 53, 55, 57, 59, 60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81, 83, 84]) {
      expect(stepToPitch(midiToStep(midi)!).midi).toBe(midi);
    }
  });

  it('puts the next note two slots right of the rightmost one on the last used staff', () => {
    expect(nextFreeSlot([])).toEqual({ slot: 2, staff: 0 });
    expect(nextFreeSlot([note(7, 0), note(3, 0)])).toEqual({ slot: 9, staff: 0 });
    expect(nextFreeSlot([note(24, 0)])).toEqual({ slot: 26, staff: 0 });
    expect(nextFreeSlot([note(20, 0), note(4, 1)])).toEqual({ slot: 6, staff: 1 });
  });

  it('wraps to slot 4 of the next staff and reports a full staff', () => {
    expect(nextFreeSlot([note(25, 0)])).toEqual({ slot: 4, staff: 1 });
    expect(nextFreeSlot([note(25, 1)])).toBeNull();
    expect(recordMidi([note(25, 1)], 69).kind).toBe('full');
  });

  it('records a stemless note and skips sharps and notes off the staff', () => {
    const r = recordMidi([], 69);
    expect(r.kind).toBe('added');
    if (r.kind === 'added') expect(r.note).toMatchObject({ slot: 2, staff: 0, step: 3, duration: 'undefined' });
    expect(recordMidi([], 61).kind).toBe('accidental');
    expect(recordMidi([], 40).kind).toBe('range'); // E2
    expect(recordMidi([], 91).kind).toBe('range'); // G6
  });

  it('places a note on its third matching frame, once', () => {
    const d = new NoteDebouncer();
    expect([440, 440, 440, 440].map((f) => d.push(f))).toEqual([null, null, 69, null]);
    expect(d.push(0)).toBeNull();
    expect([440, 440, 440].map((f) => d.push(f))).toEqual([null, null, 69]);
    expect([494, 440, 494, 494, 494].map((f) => d.push(f))).toEqual([null, null, null, null, 71]);
  });
});

describe('keyboard cursor', () => {
  it('moves across staves and stops at the ends', () => {
    expect(moveCursor({ slot: MAX_SLOT, staff: 0, step: 4 }, 'ArrowRight')).toEqual({ slot: 1, staff: 1, step: 4 });
    expect(moveCursor({ slot: MAX_SLOT, staff: 1, step: 4 }, 'ArrowRight')).toEqual({ slot: MAX_SLOT, staff: 1, step: 4 });
    expect(moveCursor({ slot: 1, staff: 1, step: 4 }, 'ArrowLeft')).toEqual({ slot: MAX_SLOT, staff: 0, step: 4 });
    expect(moveCursor({ slot: 1, staff: 0, step: 4 }, 'ArrowLeft')).toEqual({ slot: 1, staff: 0, step: 4 });
    expect(moveCursor({ slot: 3, staff: 0, step: 14 }, 'ArrowUp').step).toBe(14);
    expect(moveCursor({ slot: 3, staff: 0, step: -6 }, 'ArrowDown').step).toBe(-6);
  });
});
