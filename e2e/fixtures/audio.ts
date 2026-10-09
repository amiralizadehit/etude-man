// Deterministic WAV fixtures for Chromium's fake microphone (--use-file-for-fake-audio-capture).
// Files are generated at test time into this folder (see .gitignore here) instead of being committed.
import { existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

const SAMPLE_RATE = 48_000;
const FIXTURES_DIR = import.meta.dirname;

export type Pluck = {
  /** Sounding MIDI note (what the microphone hears: written − 12). */
  soundingMidi: number;
  durationMs?: number;
  /** Peak sample value, 0–1; defaults to the track's amplitude. */
  amplitude?: number;
  /** Exponential decay rate per second; 0 holds the note at a steady level. Defaults to the track's. */
  decayPerSecond?: number;
};

export type PluckTrackOptions = {
  /** Silence before the first pluck, so nothing is played before the app is listening. */
  leadInMs?: number;
  /** Silence after the last pluck; the fake device loops the file, so this delays the repeat. */
  tailMs?: number;
  /** Near-silent gap before each pluck, so every note is a fresh attack. */
  gapMs?: number;
  amplitude?: number;
  decayPerSecond?: number;
};

export function midiToFrequency(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

/** Plucked sine notes: a silent gap, a quick attack, then a gentle decay. */
export function pluckTrack(plucks: Pluck[], options: PluckTrackOptions = {}): Float32Array {
  const { leadInMs = 1000, tailMs = 1000, gapMs = 70, amplitude = 0.3, decayPerSecond = 2 } = options;
  const chunks: Float32Array[] = [silence(leadInMs)];
  for (const pluck of plucks) {
    chunks.push(
      silence(gapMs),
      pluckTone({
        frequencyHz: midiToFrequency(pluck.soundingMidi),
        durationMs: pluck.durationMs ?? 330,
        amplitude: pluck.amplitude ?? amplitude,
        decayPerSecond: pluck.decayPerSecond ?? decayPerSecond,
      }),
    );
  }
  chunks.push(silence(tailMs));
  return concat(chunks);
}

/** A constant sine with no attacks at all. */
export function steadyTone(frequencyHz: number, durationMs: number, amplitude = 0.3): Float32Array {
  const samples = new Float32Array(samplesFor(durationMs));
  for (let i = 0; i < samples.length; i++) {
    samples[i] = amplitude * Math.sin((2 * Math.PI * frequencyHz * i) / SAMPLE_RATE);
  }
  return samples;
}

/**
 * Writes the samples as a 48 kHz mono 16-bit WAV in e2e/fixtures/ and returns its absolute path.
 * Safe when several workers call it at once: identical content is left alone, and a new file is
 * written under a temporary name first and then renamed into place.
 */
export function writeWavFixture(fileName: string, samples: Float32Array): string {
  const filePath = path.join(FIXTURES_DIR, fileName);
  const wav = encodeWav(samples);
  if (existsSync(filePath) && readFileSync(filePath).equals(wav)) return filePath;
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(temporaryPath, wav);
  try {
    renameSync(temporaryPath, filePath);
  } catch (error) {
    unlinkSync(temporaryPath);
    // Another worker won the race with the same content.
    if (!existsSync(filePath) || !readFileSync(filePath).equals(wav)) throw error;
  }
  return filePath;
}

type Tone = { frequencyHz: number; durationMs: number; amplitude: number; decayPerSecond: number };

function pluckTone({ frequencyHz, durationMs, amplitude, decayPerSecond }: Tone): Float32Array {
  const samples = new Float32Array(samplesFor(durationMs));
  const attackSamples = samplesFor(5);
  const releaseSamples = samplesFor(10);
  for (let i = 0; i < samples.length; i++) {
    const seconds = i / SAMPLE_RATE;
    const attack = Math.min(1, i / attackSamples);
    const release = Math.min(1, (samples.length - i) / releaseSamples);
    const decay = Math.exp(-seconds * decayPerSecond);
    samples[i] = amplitude * attack * release * decay * Math.sin(2 * Math.PI * frequencyHz * seconds);
  }
  return samples;
}

function silence(durationMs: number): Float32Array {
  return new Float32Array(samplesFor(durationMs));
}

function samplesFor(durationMs: number): number {
  return Math.round((durationMs / 1000) * SAMPLE_RATE);
}

function concat(chunks: Float32Array[]): Float32Array {
  const result = new Float32Array(chunks.reduce((total, chunk) => total + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

function encodeWav(samples: Float32Array): Buffer {
  const dataBytes = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataBytes);
  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16); // fmt chunk size
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
  buffer.writeUInt16LE(2, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataBytes, 40);
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(clamped * 32767), 44 + i * 2);
  }
  return buffer;
}
