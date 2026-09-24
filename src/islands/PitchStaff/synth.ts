// Тестовые сигналы для YIN: тон с гармониками и детерминированным шумом. Только для тестов и сверки с C++.

export interface ToneOptions {
  /** Амплитуды гармоник, начиная с основной. */
  harmonics?: readonly number[];
  /** Амплитуда равномерного шума. */
  noise?: number;
  seed?: number;
}

/** Линейный конгруэнтный генератор (Numerical Recipes): одинаковый шум при каждом прогоне. */
export function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

export function tone(frequency: number, sampleRate: number, length: number, options: ToneOptions = {}): Float32Array {
  const { harmonics = [1, 0.5, 0.33, 0.25, 0.2], noise = 0.02, seed = 1 } = options;
  const random = lcg(seed);
  const norm = 0.8 / harmonics.reduce((a, b) => a + b, 0);
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    let v = 0;
    for (let h = 0; h < harmonics.length; h++) {
      v += harmonics[h]! * Math.sin((2 * Math.PI * frequency * (h + 1) * i) / sampleRate);
    }
    out[i] = v * norm + noise * (random() * 2 - 1);
  }
  return out;
}

export function whiteNoise(length: number, amplitude = 0.5, seed = 7): Float32Array {
  const random = lcg(seed);
  return Float32Array.from({ length }, () => amplitude * (random() * 2 - 1));
}

export const midiToFrequency = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
