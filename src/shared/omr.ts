// Photo upload → Flat OMR → exercise (TECH_SPEC, Phase 5): request and status shapes shared by
// the server routes and the upload page.
import { z } from "zod";

/** ~4.5 MB of base64; the browser downscales photos well below this before uploading. */
export const MAX_IMAGE_BASE64_LENGTH = 6_000_000;

export const startUploadSchema = z.object({
  name: z.string().trim().min(1).max(100),
  image: z.object({
    base64: z.string().min(1).max(MAX_IMAGE_BASE64_LENGTH),
    filename: z.string().regex(/\.(jpe?g|png)$/i),
  }),
});

export type StartUploadRequest = z.infer<typeof startUploadSchema>;

export type UploadStatus =
  | { status: "processing"; percent: number | null; stage: string | null }
  | { status: "done"; exerciseId: string }
  | { status: "error"; message: string };
