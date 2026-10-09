import { render as renderWithoutRouter, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router";
import userEvent from "@testing-library/user-event";
import ExerciseListPage from "./ExerciseListPage";
import { authClient } from "@/lib/authClient";

vi.mock("@/lib/authClient", () => ({
  authClient: { signOut: vi.fn() },
}));

function render(ui: ReactElement) {
  return renderWithoutRouter(<MemoryRouter>{ui}</MemoryRouter>);
}

function mockExercisesResponse(response: Response) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(response);
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

afterEach(() => {
  vi.restoreAllMocks();
});

test("shows the signed-in user's email", async () => {
  mockExercisesResponse(jsonResponse({ exercises: [] }));
  render(<ExerciseListPage userEmail="reviewer1@example.com" />);
  expect(screen.getByText("reviewer1@example.com")).toBeInTheDocument();
  await screen.findByText("No exercises yet.");
});

test("shows a loading message, then an empty state when there are no exercises", async () => {
  const fetchSpy = mockExercisesResponse(jsonResponse({ exercises: [] }));
  render(<ExerciseListPage userEmail="reviewer1@example.com" />);
  expect(screen.getByText("Loading exercises…")).toBeInTheDocument();
  expect(await screen.findByText("No exercises yet.")).toBeInTheDocument();
  expect(fetchSpy).toHaveBeenCalledWith("/api/exercises");
});

test("lists the user's exercises by name, each linking to its practice page", async () => {
  mockExercisesResponse(
    jsonResponse({
      exercises: [
        { id: "a", name: "Book page 12", source: "seed", createdAt: "2026-10-08T00:00:00Z" },
        { id: "b", name: "Scales", source: "upload", createdAt: "2026-10-08T00:00:00Z" },
      ],
    }),
  );
  render(<ExerciseListPage userEmail="reviewer1@example.com" />);
  const items = await screen.findAllByRole("listitem");
  expect(items.map((item) => item.textContent)).toEqual(["Book page 12", "Scales"]);
  expect(screen.getByRole("link", { name: "Book page 12" })).toHaveAttribute("href", "/exercises/a");
  expect(screen.getByRole("link", { name: "Scales" })).toHaveAttribute("href", "/exercises/b");
});

test("shows an error when the exercises can't be loaded", async () => {
  mockExercisesResponse(jsonResponse({ error: "Not signed in" }, 401));
  render(<ExerciseListPage userEmail="reviewer1@example.com" />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load your exercises.");
});

test("links to the report and to uploading a photo", async () => {
  mockExercisesResponse(jsonResponse({ exercises: [] }));
  render(<ExerciseListPage userEmail="reviewer1@example.com" />);
  expect(screen.getByRole("link", { name: "Report" })).toHaveAttribute("href", "/report");
  expect(screen.getByRole("link", { name: "+ Upload a photo" })).toHaveAttribute("href", "/upload");
  await screen.findByText("No exercises yet.");
});

test("signs out when the sign-out button is clicked", async () => {
  mockExercisesResponse(jsonResponse({ exercises: [] }));
  render(<ExerciseListPage userEmail="reviewer1@example.com" />);
  await userEvent.setup().click(screen.getByRole("button", { name: "Sign out" }));
  expect(authClient.signOut).toHaveBeenCalled();
});
