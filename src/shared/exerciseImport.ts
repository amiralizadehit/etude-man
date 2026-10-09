// MusicXML file upload, the fallback when photo recognition isn't available (TECH_SPEC, Phase 5).
import { z } from "zod";

/** Generous for a method-book page; Flat's exports of a page are tens of KB. */
export const MAX_MUSICXML_LENGTH = 3_000_000;

export const importMusicXmlSchema = z.object({
  name: z.string().trim().min(1).max(100),
  musicXml: z.string().min(1).max(MAX_MUSICXML_LENGTH),
});

export type ImportMusicXmlRequest = z.infer<typeof importMusicXmlSchema>;
