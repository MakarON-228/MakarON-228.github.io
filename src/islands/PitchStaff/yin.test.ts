import { describe, expect, it } from 'vitest';
import { midiToFrequency, tone, whiteNoise } from './synth';
import { PitchDetector } from './yin';

const BUFFER = 4096;
const cents = (f: number, ref: number) => 1200 * Math.log2(f / ref);
const detect = (data: Float32Array, sampleRate = 44100) => new PitchDetector(sampleRate, BUFFER).detectPitch(data);

describe('YIN port', () => {
  it('hears synthesised A4 = 440 Hz and C5 within 5 cents', () => {
    for (const sampleRate of [44100, 48000]) {
      expect(Math.abs(cents(detect(tone(440, sampleRate, BUFFER), sampleRate), 440))).toBeLessThan(5);
      const c5 = midiToFrequency(72);
      expect(Math.abs(cents(detect(tone(c5, sampleRate, BUFFER), sampleRate), c5))).toBeLessThan(5);
    }
  });

  it('names every semitone from C4 to C6', () => {
    for (let midi = 60; midi <= 84; midi++) {
      const f = detect(tone(midiToFrequency(midi), 44100, BUFFER, { seed: midi }));
      expect(PitchDetector.frequencyToMidiNote(f)).toBe(midi);
    }
  });

  it('finds no pitch in silence, white noise or a short buffer', () => {
    expect(detect(new Float32Array(BUFFER))).toBe(0);
    expect(detect(whiteNoise(BUFFER))).toBe(0);
    expect(detect(tone(440, 44100, BUFFER - 1))).toBe(0);
  });

  it('converts frequency to MIDI like the C++', () => {
    expect(PitchDetector.frequencyToMidiNote(440)).toBe(69);
    expect(PitchDetector.frequencyToMidiNote(261.63)).toBe(60);
    expect(PitchDetector.frequencyToMidiNote(0)).toBe(-1);
    expect(PitchDetector.frequencyToMidiNote(-3)).toBe(-1);
  });

  // Эталон — оригинальный `src/audio/PitchDetector.cpp` из Note_redactor: те же сигналы (`synth.ts`) записаны в
  // float32-файлы, прочитаны маленьким main.cpp (g++ -std=c++17 -O2) и прогнаны через `detectPitch`, вывод `%.9g`.
  // Арифметика порта — float32, как в C++, поэтому совпадение точное.
  it('matches the original C++ bit for bit', () => {
    const golden: [Float32Array, number, number][] = [
      [tone(440, 44100, BUFFER), 44100, 440.015228],
      [tone(midiToFrequency(72), 44100, BUFFER), 44100, 523.289062],
      [tone(midiToFrequency(64), 48000, BUFFER), 48000, 329.625549],
      [tone(midiToFrequency(79), 44100, BUFFER, { harmonics: [1], noise: 0 }), 44100, 784.09436],
      [tone(110, 44100, BUFFER, { seed: 3 }), 44100, 109.981255],
      [tone(447.3, 44100, BUFFER, { seed: 5, noise: 0.05 }), 44100, 447.300507],
    ];
    for (const [data, sampleRate, expected] of golden) {
      expect(detect(data, sampleRate)).toBe(Math.fround(expected));
    }
  });
});
