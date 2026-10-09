import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import type { TransitionReport } from "../../shared/transitions";
import ReportPage from "./ReportPage";

const REPORT: TransitionReport = {
  attemptCount: 6,
  notesPlayed: 438,
  firstTryAccuracy: 0.929,
  includesSample: true,
  transitions: [
    {
      fromMidi: 72,
      toMidi: 60,
      occurrences: 12,
      missedOccurrences: 7,
      missRate: 7 / 12,
      medianHesitationMs: 1861,
      sources: [
        { exerciseId: "book", exerciseName: "Sample Music Sheet", noteIndex: 1 },
        { exerciseId: "book", exerciseName: "Sample Music Sheet", noteIndex: 17 },
      ],
      includesSample: true,
    },
    {
      fromMidi: 71,
      toMidi: 77,
      occurrences: 6,
      missedOccurrences: 0,
      missRate: 0,
      medianHesitationMs: null,
      sources: [{ exerciseId: "book", exerciseName: "Sample Music Sheet", noteIndex: 45 }],
      includesSample: true,
    },
  ],
};

function mockReport(report: TransitionReport | null, status = 200) {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(report ? { report } : { error: "Boom" }), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function renderReport() {
  render(
    <MemoryRouter>
      <ReportPage />
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

test("shows a loading message, then the report", async () => {
  mockReport(REPORT);
  renderReport();
  expect(screen.getByText("Loading report…")).toBeInTheDocument();
  expect(await screen.findByRole("table")).toBeInTheDocument();
  expect(globalThis.fetch).toHaveBeenCalledWith("/api/report");
});

test("shows overall first-try accuracy with notes and attempts", async () => {
  mockReport(REPORT);
  renderReport();
  expect(await screen.findByText(/Overall accuracy:/)).toHaveTextContent(
    "Overall accuracy: 93% of notes right on the first try (438 notes, 6 attempts).",
  );
});

test("lists weak transitions with note names, miss rate, hesitation and where they came from", async () => {
  mockReport(REPORT);
  renderReport();
  const rows = within(await screen.findByRole("table")).getAllByRole("row").slice(1);
  expect(rows.map((row) => within(row).getAllByRole("cell").map((cell) => cell.textContent))).toEqual([
    ["C5 → C4", "58% (7 of 12)", "1.9 s", "Sample Music Sheet: notes 2, 18"],
    ["B4 → F5", "0% (0 of 6)", "—", "Sample Music Sheet: note 46"],
  ]);
});

test("labels sample data clearly", async () => {
  mockReport(REPORT);
  renderReport();
  expect(await screen.findByText("Includes sample practice history")).toBeInTheDocument();
});

test("has no sample label for real practice data", async () => {
  mockReport({ ...REPORT, includesSample: false });
  renderReport();
  await screen.findByRole("table");
  expect(screen.queryByText("Includes sample practice history")).not.toBeInTheDocument();
});

test("explains the empty state when there isn't enough practice yet", async () => {
  mockReport({ attemptCount: 0, notesPlayed: 0, firstTryAccuracy: null, includesSample: false, transitions: [] });
  renderReport();
  expect(
    await screen.findByText("Not enough practice yet. A transition shows up here once you've played it at least 3 times."),
  ).toBeInTheDocument();
  expect(screen.queryByText(/Overall accuracy/)).not.toBeInTheDocument();
});

test("shows an error when the report can't be loaded", async () => {
  mockReport(null, 500);
  renderReport();
  expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load your report.");
});

test("links back to the exercise list", async () => {
  mockReport(REPORT);
  renderReport();
  expect(screen.getByRole("link", { name: "← Back to exercises" })).toHaveAttribute("href", "/");
  await screen.findByRole("table");
});
