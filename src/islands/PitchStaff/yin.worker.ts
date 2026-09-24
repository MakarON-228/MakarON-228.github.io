// YIN в воркере: float32-арифметика порта в 2–3 раза медленнее двойной, и на телефоне кадр не должен
// занимать главный поток. На входе кадр 4096 сэмплов, на выходе частота (0 — высоты нет).

import { PitchDetector } from './yin';

export interface FrameRequest {
  sampleRate: number;
  frame: Float32Array;
}

const scope = self as unknown as {
  onmessage: ((e: MessageEvent<FrameRequest>) => void) | null;
  postMessage(frequency: number): void;
};

let detector: PitchDetector | null = null;

scope.onmessage = ({ data: { sampleRate, frame } }) => {
  if (!detector || detector.sampleRate !== sampleRate || detector.bufferSize !== frame.length) {
    detector = new PitchDetector(sampleRate, frame.length);
  }
  scope.postMessage(detector.detectPitch(frame));
};
