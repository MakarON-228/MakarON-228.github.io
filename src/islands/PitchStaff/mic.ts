// Захват микрофона для записи (SPEC.md §7.9). Как `AudioRecorder` десктопа: кадры по 4096 сэмплов идут подряд —
// очередной забирается, когда в анализаторе набрался новый кадр (4096 / sampleRate с), и уходит в YIN-воркер.
// Звук никуда не отправляется и на выход не подключён.

import type { FrameRequest } from './yin.worker';

export const BUFFER_SIZE = 4096;

export type MicError = 'denied' | 'missing' | 'insecure' | 'failed';

export interface Mic {
  stop(): void;
}

function micError(err: unknown): MicError {
  const name = err instanceof DOMException ? err.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'missing';
  return 'failed';
}

/** Запускает микрофон; `onFrequency` получает частоту каждого кадра (0 — высоты нет). Ошибка — `MicError`. */
export async function startMic(onFrequency: (frequency: number) => void): Promise<Mic> {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw 'insecure' satisfies MicError;

  let stream: MediaStream;
  try {
    // Шумо- и эхоподавление искажают тон — детектору нужен сырой сигнал.
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
  } catch (err) {
    throw micError(err);
  }

  const ctx = new AudioContext();
  const worker = new Worker(new URL('./yin.worker.ts', import.meta.url), { type: 'module' });
  let raf = 0;
  let stopped = false;

  const stop = () => {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(raf);
    worker.terminate();
    for (const track of stream.getTracks()) track.stop();
    void ctx.close();
  };

  try {
    await ctx.resume();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = BUFFER_SIZE;
    ctx.createMediaStreamSource(stream).connect(analyser);

    const period = (BUFFER_SIZE / ctx.sampleRate) * 1000;
    let last = performance.now();
    let busy = false;

    worker.onmessage = (e: MessageEvent<number>) => {
      busy = false;
      if (!stopped) onFrequency(e.data);
    };

    const tick = (now: number) => {
      if (stopped) return;
      // Медленный телефон не успевает — кадр пропускается, очередь не копится.
      if (!busy && now - last >= period) {
        last = now;
        busy = true;
        const frame = new Float32Array(BUFFER_SIZE);
        analyser.getFloatTimeDomainData(frame);
        worker.postMessage({ sampleRate: ctx.sampleRate, frame } satisfies FrameRequest, [frame.buffer]);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  } catch {
    stop();
    throw 'failed' satisfies MicError;
  }

  return { stop };
}
