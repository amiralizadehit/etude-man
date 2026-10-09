import { expect, test, vi } from "vitest";
import { createFlatClient, FlatApiError } from "./flat";

function fakeFetch(response: Response) {
  return vi.fn<typeof fetch>(async () => response);
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

test("creates a started MusicXML job with no interactive steps", async () => {
  const fetchSpy = fakeFetch(json({ id: "job-1", status: "processing" }, 202));
  const job = await createFlatClient("secret-token", fetchSpy).createJob({ base64: "AAAA", filename: "page.jpg" });

  expect(job).toEqual({ id: "job-1", status: "processing" });
  const [url, init] = fetchSpy.mock.calls[0];
  expect(url).toBe("https://api.flat.io/v2/omr/jobs");
  expect(init?.method).toBe("POST");
  expect(init?.headers).toEqual({ Authorization: "Bearer secret-token", "Content-Type": "application/json" });
  expect(JSON.parse(init?.body as string)).toEqual({
    output: "musicxml",
    autoStart: true,
    interactiveSteps: [],
    files: [{ file: "AAAA", filename: "page.jpg" }],
  });
});

test("long-polls a job with the wait parameter", async () => {
  const fetchSpy = fakeFetch(json({ id: "job-1", status: "processing", progress: { percent: 42, text: "Reading notes" } }));
  const job = await createFlatClient("t", fetchSpy).getJob("job-1", 20);
  expect(fetchSpy.mock.calls[0][0]).toBe("https://api.flat.io/v2/omr/jobs/job-1?wait=20");
  expect(job.progress?.percent).toBe(42);
});

test("submits a paused step without changes", async () => {
  const fetchSpy = fakeFetch(json({ id: "job-1", status: "processing" }));
  await createFlatClient("t", fetchSpy).submitStepUnchanged("job-1", "details");
  const [url, init] = fetchSpy.mock.calls[0];
  expect(url).toBe("https://api.flat.io/v2/omr/jobs/job-1/steps/details");
  expect(JSON.parse(init?.body as string)).toEqual({ step: "details" });
});

test("downloads the MusicXML export as text", async () => {
  const fetchSpy = fakeFetch(new Response("<score-partwise/>"));
  expect(await createFlatClient("t", fetchSpy).exportMusicXml("job-1")).toBe("<score-partwise/>");
  expect(fetchSpy.mock.calls[0][0]).toBe("https://api.flat.io/v2/omr/jobs/job-1/exports/musicxml");
});

test("keeps Flat's HTTP status on errors, e.g. 402 for insufficient credits", async () => {
  const fetchSpy = fakeFetch(json({ code: "INSUFFICIENT_CREDITS" }, 402));
  const error = await createFlatClient("t", fetchSpy)
    .createJob({ base64: "AAAA", filename: "page.jpg" })
    .catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(FlatApiError);
  expect((error as FlatApiError).status).toBe(402);
});
