import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import PracticePage from "./PracticePage";

vi.mock("@/practice/PracticeSession", () => ({
  default: ({ exerciseId, musicXml, saveAttempt }: { exerciseId: string; musicXml: string; saveAttempt(a: unknown): Promise<void> }) => (
    <div data-testid="practice-session">
      {exerciseId} {musicXml}
      <button onClick={() => void saveAttempt({ exerciseId, completed: true })}>save</button>
    </div>
  ),
}));

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function renderPracticePage(exerciseId = "ex-1") {
  render(
    <MemoryRouter initialEntries={[`/exercises/${exerciseId}`]}>
      <Routes>
        <Route path="/exercises/:exerciseId" element={<PracticePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

test("loads the exercise from the URL and starts a practice session for it", async () => {
  const fetchSpy = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(jsonResponse({ exercise: { id: "ex-1", name: "Sample Music Sheet", source: "seed", musicXml: "<x/>" } }));
  renderPracticePage("ex-1");
  expect(screen.getByText("Loading exercise…")).toBeInTheDocument();
  expect(await screen.findByRole("heading", { name: "Sample Music Sheet" })).toBeInTheDocument();
  expect(fetchSpy).toHaveBeenCalledWith("/api/exercises/ex-1");
  expect(screen.getByTestId("practice-session")).toHaveTextContent("ex-1 <x/>");
});

test("links back to the exercise list", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ exercise: { id: "ex-1", name: "X", source: "seed", musicXml: "" } }));
  renderPracticePage();
  expect(screen.getByRole("link", { name: "← Back to exercises" })).toHaveAttribute("href", "/");
  await screen.findByRole("heading", { name: "X" });
});

test("says when the exercise doesn't exist", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ error: "Exercise not found" }, 404));
  renderPracticePage("missing");
  expect(await screen.findByRole("alert")).toHaveTextContent("This exercise doesn't exist.");
});

test("shows an error when the exercise can't be loaded", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ error: "Boom" }, 500));
  renderPracticePage();
  expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load this exercise.");
});

test("saves attempts by posting them to the API", async () => {
  const fetchSpy = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(jsonResponse({ exercise: { id: "ex-1", name: "X", source: "seed", musicXml: "" } }))
    .mockResolvedValueOnce(jsonResponse({ attempt: { id: "a-1" } }, 201));
  renderPracticePage();
  (await screen.findByRole("button", { name: "save" })).click();
  await vi.waitFor(() =>
    expect(fetchSpy).toHaveBeenLastCalledWith("/api/attempts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ exerciseId: "ex-1", completed: true }),
    }),
  );
});
