import { DOMParser } from "@xmldom/xmldom";
import { readFileSync } from "node:fs";
import { findMusicXmlProblem, listPlayableWrittenMidis, normalizeMusicXml } from "./musicxml";

type Pitch = { step: string; octave: number; alter?: number };

function scoreXml({ clef = "", transpose = "", pitches }: { clef?: string; transpose?: string; pitches: Pitch[] }) {
  const notes = pitches
    .map(
      ({ step, octave, alter }) =>
        `<note><pitch><step>${step}</step>${alter ? `<alter>${alter}</alter>` : ""}<octave>${octave}</octave></pitch><duration>1</duration><type>quarter</type></note>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Guitar</part-name></score-part></part-list>
  <part id="P1"><measure number="1">
    <attributes><divisions>1</divisions><clef><sign>G</sign><line>2</line>${clef}</clef>${transpose}</attributes>
    ${notes}
  </measure></part>
</score-partwise>`;
}

function readPitches(musicXml: string): Pitch[] {
  const doc = new DOMParser().parseFromString(musicXml, "text/xml");
  return Array.from(doc.getElementsByTagName("pitch")).map((pitch) => {
    const text = (tag: string) => pitch.getElementsByTagName(tag)[0]?.textContent;
    const alter = text("alter");
    return { step: text("step")!, octave: Number(text("octave")), ...(alter ? { alter: Number(alter) } : {}) };
  });
}

const OCTAVE_DOWN_CLEF = "<clef-octave-change>-1</clef-octave-change>";
const OCTAVE_TRANSPOSE = "<transpose><diatonic>0</diatonic><chromatic>0</chromatic><octave-change>-1</octave-change></transpose>";

test("raises treble-8vb pitches an octave to written pitch and removes the clef octave change", () => {
  const normalized = normalizeMusicXml(
    scoreXml({ clef: OCTAVE_DOWN_CLEF, pitches: [{ step: "E", octave: 2 }, { step: "F", octave: 3, alter: 1 }] }),
  );
  expect(readPitches(normalized)).toEqual([
    { step: "E", octave: 3 },
    { step: "F", octave: 4, alter: 1 },
  ]);
  expect(normalized).not.toContain("clef-octave-change");
});

test("removes a transpose element without changing pitches", () => {
  const normalized = normalizeMusicXml(scoreXml({ transpose: OCTAVE_TRANSPOSE, pitches: [{ step: "E", octave: 3 }] }));
  expect(readPitches(normalized)).toEqual([{ step: "E", octave: 3 }]);
  expect(normalized).not.toContain("<transpose");
});

test("leaves a plain treble clef score unchanged in content", () => {
  const original = scoreXml({ pitches: [{ step: "G", octave: 4 }, { step: "B", octave: 4, alter: -1 }] });
  const normalized = normalizeMusicXml(original);
  expect(readPitches(normalized)).toEqual(readPitches(original));
  expect(normalized).toContain("<clef><sign>G</sign><line>2</line></clef>");
});

test("is idempotent", () => {
  const once = normalizeMusicXml(scoreXml({ clef: OCTAVE_DOWN_CLEF, pitches: [{ step: "A", octave: 2 }] }));
  expect(normalizeMusicXml(once)).toBe(once);
  expect(readPitches(once)).toEqual([{ step: "A", octave: 3 }]);
});

test("keeps the doctype, rests and other elements", () => {
  const withRest = scoreXml({ pitches: [{ step: "C", octave: 5 }] }).replace(
    "</measure>",
    "<note><rest/><duration>1</duration><type>quarter</type></note></measure>",
  );
  const normalized = normalizeMusicXml(withRest);
  expect(normalized).toContain("<!DOCTYPE score-partwise");
  expect(normalized).toContain("<rest/>");
  expect(normalized).toContain("<part-name>Guitar</part-name>");
});

describe("listPlayableWrittenMidis", () => {
  test("reads written MIDI notes in order, with alterations", () => {
    const xml = scoreXml({ pitches: [{ step: "C", octave: 5 }, { step: "F", octave: 4, alter: 1 }, { step: "B", octave: 3, alter: -1 }] });
    expect(listPlayableWrittenMidis(xml)).toEqual([72, 66, 58]);
  });

  test("skips rests, grace notes and tied continuations; a chord counts once as its top note", () => {
    const notes = [
      `<note><pitch><step>C</step><octave>5</octave></pitch><duration>2</duration></note>`,
      `<note><chord/><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration></note>`,
      `<note><rest/><duration>1</duration></note>`,
      `<note><grace/><pitch><step>D</step><octave>5</octave></pitch></note>`,
      `<note><pitch><step>G</step><octave>4</octave></pitch><duration>1</duration><tie type="start"/></note>`,
      `<note><pitch><step>G</step><octave>4</octave></pitch><duration>1</duration><tie type="stop"/></note>`,
      `<note><pitch><step>E</step><octave>3</octave></pitch><duration>1</duration></note>`,
    ].join("");
    const xml = scoreXml({ pitches: [] }).replace("</measure>", `${notes}</measure>`);
    expect(listPlayableWrittenMidis(xml)).toEqual([72, 67, 52]);
  });

  test("matches the verified book exercise (same sequence the OSMD cursor yields)", () => {
    const book = readFileSync("assets/Sample Music Sheet.musicxml", "utf8"); // Vitest runs from the project root
    const sequence = listPlayableWrittenMidis(normalizeMusicXml(book));
    expect(sequence).toHaveLength(73);
    expect(sequence.slice(0, 8)).toEqual([72, 60, 76, 74, 72, 71, 69, 67]);
    expect(sequence.slice(32, 36)).toEqual([60, 52, 53, 55]);
    expect(sequence.at(-1)).toBe(72);
  });
});

describe("findMusicXmlProblem", () => {
  test("accepts a partwise score with playable notes", () => {
    expect(findMusicXmlProblem(scoreXml({ pitches: [{ step: "C", octave: 5 }] }))).toBeNull();
  });

  test("accepts the verified book exercise", () => {
    expect(findMusicXmlProblem(readFileSync("assets/Sample Music Sheet.musicxml", "utf8"))).toBeNull();
  });

  test("rejects text that isn't XML", () => {
    expect(findMusicXmlProblem("just some notes: C D E")).toBe("not-musicxml");
  });

  test("rejects XML that isn't a partwise MusicXML score", () => {
    expect(findMusicXmlProblem("<html><body>hello</body></html>")).toBe("not-musicxml");
    expect(findMusicXmlProblem("<score-timewise version=\"4.0\"></score-timewise>")).toBe("not-musicxml");
  });

  test("rejects a score with no playable notes", () => {
    const onlyRests = scoreXml({ pitches: [] }).replace("</measure>", "<note><rest/><duration>4</duration></note></measure>");
    expect(findMusicXmlProblem(onlyRests)).toBe("no-notes");
  });
});
