import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import App from "./App";
import { authClient } from "@/lib/authClient";

vi.mock("@/lib/authClient", () => ({
  authClient: { useSession: vi.fn() },
}));
vi.mock("@/pages/LoginPage", () => ({ default: () => <p>Login page</p> }));
vi.mock("@/pages/ExerciseListPage", () => ({
  default: ({ userEmail }: { userEmail: string }) => <p>Exercise list for {userEmail}</p>,
}));
vi.mock("@/pages/PracticePage", () => ({ default: () => <p>Practice page</p> }));
vi.mock("@/pages/ReportPage", () => ({ default: () => <p>Report page</p> }));

const useSession = vi.mocked(authClient.useSession);
const SIGNED_IN = { data: { user: { email: "reviewer1@example.com" } }, isPending: false };

function mockSession(state: { data: unknown; isPending: boolean }) {
  useSession.mockReturnValue(state as ReturnType<typeof authClient.useSession>);
}

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

test("shows a loading message while the session is being checked", () => {
  mockSession({ data: null, isPending: true });
  renderAt("/");
  expect(screen.getByText("Loading…")).toBeInTheDocument();
});

test("shows the login page when nobody is signed in, whatever the URL", () => {
  mockSession({ data: null, isPending: false });
  renderAt("/exercises/abc");
  expect(screen.getByText("Login page")).toBeInTheDocument();
});

test("shows the exercise list for the signed-in user at /", () => {
  mockSession(SIGNED_IN);
  renderAt("/");
  expect(screen.getByText("Exercise list for reviewer1@example.com")).toBeInTheDocument();
});

test("shows the practice page at /exercises/:exerciseId", () => {
  mockSession(SIGNED_IN);
  renderAt("/exercises/abc");
  expect(screen.getByText("Practice page")).toBeInTheDocument();
});

test("shows the report at /report", () => {
  mockSession(SIGNED_IN);
  renderAt("/report");
  expect(screen.getByText("Report page")).toBeInTheDocument();
});

test("sends unknown URLs to the exercise list", () => {
  mockSession(SIGNED_IN);
  renderAt("/nowhere");
  expect(screen.getByText("Exercise list for reviewer1@example.com")).toBeInTheDocument();
});
