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
