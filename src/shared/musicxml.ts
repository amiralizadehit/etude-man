// MusicXML normalization (TECH_SPEC, Pitch convention): every stored exercise uses plain
// written pitch with no transposition markings, so the rest of the app sees one format.
import { DOMParser, XMLSerializer, type Element } from "@xmldom/xmldom";

export function normalizeMusicXml(musicXml: string): string {
  const doc = new DOMParser().parseFromString(musicXml, "text/xml");
  for (const part of Array.from(doc.getElementsByTagName("part"))) {
    normalizePart(part);
  }
  return new XMLSerializer().serializeToString(doc);
}

function normalizePart(part: Element) {
  const octaveDownChanges = elements(part, "clef-octave-change").filter((el) => el.textContent?.trim() === "-1");
  // Treble-8vb: the file stores sounding pitch, so raise every note to written pitch.
  if (octaveDownChanges.length > 0) {
    raiseOctave(part);
    octaveDownChanges.forEach(remove);
  }
  // A transpose element only says how the written pitches sound; they are already written.
  elements(part, "transpose").forEach(remove);
}

function raiseOctave(part: Element) {
  for (const octave of elements(part, "octave")) {
    if (octave.parentNode?.nodeName === "pitch") {
      octave.textContent = String(Number(octave.textContent) + 1);
    }
  }
}

function elements(parent: Element, tagName: string): Element[] {
  return Array.from(parent.getElementsByTagName(tagName));
}

function remove(el: Element) {
  el.parentNode?.removeChild(el);
}

const STEP_SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/**
 * The playable note sequence read straight from MusicXML, with the same rules as the client's
 * OSMD-based playableSequence: rests, grace notes and tied continuations are skipped, and a
 * chord counts once, as its top note. Single part, repeats ignored. Returns written MIDI notes.
 */
export function listPlayableWrittenMidis(musicXml: string): number[] {
  const doc = new DOMParser().parseFromString(musicXml, "text/xml");
  const sequence: number[] = [];
  for (const note of elements(doc.documentElement!, "note")) {
    const midi = playableMidi(note);
    if (midi === null) continue;
    const isChordMember = note.getElementsByTagName("chord").length > 0;
    if (isChordMember && sequence.length > 0) {
      sequence[sequence.length - 1] = Math.max(sequence[sequence.length - 1], midi);
    } else {
      sequence.push(midi);
    }
  }
  return sequence;
}

function playableMidi(note: Element): number | null {
  const pitch = note.getElementsByTagName("pitch")[0];
  const isGrace = note.getElementsByTagName("grace").length > 0;
  const isTiedContinuation = elements(note, "tie").some((tie) => tie.getAttribute("type") === "stop");
  if (!pitch || isGrace || isTiedContinuation) return null;
  const text = (tag: string) => pitch.getElementsByTagName(tag)[0]?.textContent?.trim() ?? "";
  const octave = Number(text("octave"));
  const alter = Number(text("alter") || 0);
  return (octave + 1) * 12 + STEP_SEMITONES[text("step")] + alter;
}
