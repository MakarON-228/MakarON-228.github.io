// Порт `src/audio/PitchDetector.cpp` из Score Editor (github.com/MakarON-228/Note_redactor) — SPEC.md §7.9.
// Структура, имена и граничные случаи те же, что в C++; `Float32Array` вместо `std::vector<float>`,
// а арифметика округляется до float32 (`f32`), как у `float` в оригинале.

const f32 = Math.fround;

export class PitchDetector {
  readonly sampleRate: number;
  readonly bufferSize: number;
  private readonly yinBuffer: Float32Array;

  constructor(sampleRate: number, bufferSize: number) {
    this.sampleRate = sampleRate;
    this.bufferSize = bufferSize;
    this.yinBuffer = new Float32Array(bufferSize / 2);
  }

  /** Частота в Hz или 0, если явной высоты нет. */
  detectPitch(audioData: ArrayLike<number>): number {
    if (audioData.length < this.bufferSize) return 0;

    const halfBufferSize = this.bufferSize / 2;
    const yin = this.yinBuffer;

    // Шаг 1: разностная функция
    yin.fill(0);
    for (let tau = 1; tau < halfBufferSize; tau++) {
      let sum = 0;
      for (let i = 0; i < halfBufferSize; i++) {
        const delta = f32(audioData[i]! - audioData[i + tau]!);
        sum = f32(sum + f32(delta * delta));
      }
      yin[tau] = sum;
    }

    // Шаг 2: кумулятивная нормализация
    yin[0] = 1;
    let runningSum = 0;
    for (let tau = 1; tau < halfBufferSize; tau++) {
      runningSum = f32(runningSum + yin[tau]!);
      yin[tau] = yin[tau]! * f32(tau / runningSum);
    }

    // Шаг 3: абсолютный порог
    const tauEstimate = this.absoluteThreshold(f32(0.1)); // 0.1f

    // Шаг 4: параболическая интерполяция
    if (tauEstimate !== -1) {
      const betterTau = this.parabolicInterpolation(tauEstimate);
      return f32(this.sampleRate / betterTau);
    }

    return 0;
  }

  /** MIDI-номер ноты (69 = A4 = 440 Hz) или −1. */
  static frequencyToMidiNote(frequency: number): number {
    if (frequency <= 0) return -1;
    return roundHalfAway(69 + 12 * Math.log2(frequency / 440));
  }

  private absoluteThreshold(threshold: number): number {
    const halfBufferSize = this.bufferSize / 2;
    const yin = this.yinBuffer;
    for (let tau = 2; tau < halfBufferSize; tau++) {
      if (yin[tau]! < threshold) {
        while (tau + 1 < halfBufferSize && yin[tau + 1]! < yin[tau]!) {
          tau++;
        }
        return tau;
      }
    }
    return -1;
  }

  private parabolicInterpolation(tauEstimate: number): number {
    const halfBufferSize = this.bufferSize / 2;
    const yin = this.yinBuffer;
    const x0 = tauEstimate < 1 ? tauEstimate : tauEstimate - 1;
    const x2 = tauEstimate + 1 < halfBufferSize ? tauEstimate + 1 : tauEstimate;

    if (x0 === tauEstimate) {
      return yin[tauEstimate]! <= yin[x2]! ? tauEstimate : x2;
    }
    if (x2 === tauEstimate) {
      return yin[tauEstimate]! <= yin[x0]! ? tauEstimate : x0;
    }

    const s0 = yin[x0]!;
    const s1 = yin[tauEstimate]!;
    const s2 = yin[x2]!;

    return f32(tauEstimate + f32(f32(0.5 * f32(s2 - s0)) / f32(f32(f32(2 * s1) - s2) - s0)));
  }
}

/** `std::round`: половина — от нуля (у `Math.round` половина — вверх). */
function roundHalfAway(x: number): number {
  return Math.sign(x) * Math.round(Math.abs(x));
}
