// Flat.io OMR Interactive Jobs API (https://flat.io/developers/docs/api/omr/jobs). Server-side only:
// the token never reaches the browser.

const FLAT_API_URL = "https://api.flat.io/v2";

export type FlatJobStatus = "draft" | "processing" | "awaitingInput" | "done" | "error" | "canceled";

export type FlatJob = {
  id: string;
  status: FlatJobStatus;
  progress?: { percent?: number; text?: string; key?: string };
  currentStep?: string;
  errorCode?: string;
  errorMessage?: string;
};

export class FlatApiError extends Error {
  constructor(
    readonly status: number,
    /** Flat's machine-readable error code, e.g. SCORE_IMPORT_OMR_NOT_SUPPORTED, when it sent one. */
    readonly code: string | null,
    message: string,
  ) {
    super(message);
  }
}

/** Flat answers this when the account or token can't use photo recognition. */
export const OMR_NOT_SUPPORTED_CODE = "SCORE_IMPORT_OMR_NOT_SUPPORTED";

export type FlatClient = ReturnType<typeof createFlatClient>;

export function createFlatClient(token: string, fetchImpl: typeof fetch = fetch) {
  async function request(path: string, init: RequestInit = {}): Promise<Response> {
    const response = await fetchImpl(`${FLAT_API_URL}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, ...(init.body ? { "Content-Type": "application/json" } : {}) },
    });
    if (!response.ok) {
      const body = await response.text();
      throw new FlatApiError(response.status, errorCodeOf(body), `Flat ${init.method ?? "GET"} ${path} failed with ${response.status}: ${body}`);
    }
    return response;
  }

  return {
    /** Creates, starts and charges the job in one call; no interactive steps, so Flat resolves them all. */
    async createJob(image: { base64: string; filename: string }): Promise<FlatJob> {
      const response = await request("/omr/jobs", {
        method: "POST",
        body: JSON.stringify({
          output: "musicxml",
          autoStart: true,
          interactiveSteps: [],
          files: [{ file: image.base64, filename: image.filename }],
        }),
      });
      return (await response.json()) as FlatJob;
    },

    /** Long-polls: returns as soon as the job changes, or after `waitSeconds` (0–25). */
    async getJob(jobId: string, waitSeconds: number): Promise<FlatJob> {
      const response = await request(`/omr/jobs/${encodeURIComponent(jobId)}?wait=${waitSeconds}`);
      return (await response.json()) as FlatJob;
    },

    /** Accepts Flat's detected values for a paused step, so the job carries on. */
    async submitStepUnchanged(jobId: string, step: string): Promise<FlatJob> {
      const response = await request(`/omr/jobs/${encodeURIComponent(jobId)}/steps/${encodeURIComponent(step)}`, {
        method: "POST",
        body: JSON.stringify({ step }),
      });
      return (await response.json()) as FlatJob;
    },

    async exportMusicXml(jobId: string): Promise<string> {
      const response = await request(`/omr/jobs/${encodeURIComponent(jobId)}/exports/musicxml`);
      return response.text();
    },
  };
}

function errorCodeOf(body: string): string | null {
  try {
    const parsed: unknown = JSON.parse(body);
    const code = (parsed as { code?: unknown }).code;
    return typeof code === "string" ? code : null;
  } catch {
    return null;
  }
}

export function flatClientFromEnv(): FlatClient {
  const token = process.env.FLAT_TOKEN;
  if (!token) {
    throw new Error("FLAT_TOKEN is not set");
  }
  return createFlatClient(token);
}
