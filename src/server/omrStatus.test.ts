import { expect, test } from "vitest";
import { COULD_NOT_READ_PHOTO, failedStatus, processingStatus } from "./omrStatus";

test("reports progress percent and stage while processing", () => {
  expect(processingStatus({ id: "j", status: "processing", progress: { percent: 42.4, text: "Reading notes", key: "OMR_READING_NOTES" } })).toEqual({
    status: "processing",
    percent: 42,
    stage: "Reading notes",
  });
});

test("clamps the percent to 0–100", () => {
  expect(processingStatus({ id: "j", status: "processing", progress: { percent: 140 } })).toMatchObject({ percent: 100 });
  expect(processingStatus({ id: "j", status: "processing", progress: { percent: -5 } })).toMatchObject({ percent: 0 });
});

test("has no percent or stage when Flat hasn't reported progress yet", () => {
  expect(processingStatus({ id: "j", status: "processing" })).toEqual({ status: "processing", percent: null, stage: null });
  expect(processingStatus({ id: "j", status: "processing", progress: { text: "  " } })).toMatchObject({ stage: null });
});

test("explains a failed job, with Flat's message when there is one", () => {
  expect(failedStatus({ id: "j", status: "error", errorCode: "OMR_FAILED", errorMessage: "No staves detected" })).toEqual({
    status: "error",
    message: `${COULD_NOT_READ_PHOTO} (No staves detected)`,
  });
  expect(failedStatus({ id: "j", status: "canceled" })).toEqual({ status: "error", message: COULD_NOT_READ_PHOTO });
});
