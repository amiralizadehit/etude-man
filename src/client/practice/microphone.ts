// Microphone pipeline (TECH_SPEC, Phase 3): stream with echo cancellation, noise suppression
// and auto gain off → analyser → pitchy on each animation frame → AudioFrame for the detector.
import { PitchDetector } from "pitchy";
import type { AudioFrame } from "../../shared/detector";

export const DEFAULT_BUFFER_SIZE = 2048;

export type InputDevice = { deviceId: string; label: string };

export type MicrophoneSession = {
  stop(): void;
};

export type MicrophoneOptions = {
  /** Undefined uses the browser's default input. */
  deviceId?: string;
  bufferSize?: number;
  onFrame(frame: AudioFrame): void;
};

/** Device labels are only filled in once microphone permission has been granted. */
export async function listInputDevices(): Promise<InputDevice[]> {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter((device) => device.kind === "audioinput")
    .map((device, index) => ({ deviceId: device.deviceId, label: device.label || `Microphone ${index + 1}` }));
}

/**
 * Starts listening. Call it from a click handler: the AudioContext is created before the first
 * await, because browsers only allow audio to start from a user gesture.
 */
export async function startMicrophone({
  deviceId,
  bufferSize = DEFAULT_BUFFER_SIZE,
  onFrame,
}: MicrophoneOptions): Promise<MicrophoneSession> {
  const audioContext = new AudioContext();
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
  } catch (error) {
    void audioContext.close();
    throw error;
  }

  const analyser = audioContext.createAnalyser();
  analyser.fftSize = bufferSize;
  audioContext.createMediaStreamSource(stream).connect(analyser);
  const samples = new Float32Array(analyser.fftSize);
  const pitchDetector = PitchDetector.forFloat32Array(analyser.fftSize);

  let animationFrame = requestAnimationFrame(function readFrame(timeMs) {
    analyser.getFloatTimeDomainData(samples);
    const [frequencyHz, clarity] = pitchDetector.findPitch(samples, audioContext.sampleRate);
    onFrame({ timeMs, rms: rootMeanSquare(samples), frequencyHz: clarity > 0 ? frequencyHz : null, clarity });
    animationFrame = requestAnimationFrame(readFrame);
  });

  return {
    stop() {
      cancelAnimationFrame(animationFrame);
      stream.getTracks().forEach((track) => track.stop());
      void audioContext.close();
    },
  };
}

export function rootMeanSquare(samples: ArrayLike<number>): number {
  if (samples.length === 0) return 0;
  let sumOfSquares = 0;
  for (let i = 0; i < samples.length; i++) {
    sumOfSquares += samples[i] * samples[i];
  }
  return Math.sqrt(sumOfSquares / samples.length);
}
