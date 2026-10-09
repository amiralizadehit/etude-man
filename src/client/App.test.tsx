import { render, screen } from "@testing-library/react";
import App from "./App";
import { authClient } from "@/lib/authClient";

vi.mock("@/lib/authClient", () => ({
  authClient: { useSession: vi.fn() },
}));
vi.mock("@/pages/LoginPage", () => ({ default: () => <p>Login page</p> }));
vi.mock("@/pages/ExerciseListPage", () => ({
  default: ({ userEmail }: { userEmail: string }) => <p>Exercise list for {userEmail}</p>,
}));

const useSession = vi.mocked(authClient.useSession);

function mockSession(state: { data: unknown; isPending: boolean }) {
  useSession.mockReturnValue(state as ReturnType<typeof authClient.useSession>);
}

test("shows a loading message while the session is being checked", () => {
  mockSession({ data: null, isPending: true });
  render(<App />);
  expect(screen.getByText("Loading…")).toBeInTheDocument();
});

test("shows the login page when nobody is signed in", () => {
  mockSession({ data: null, isPending: false });
  render(<App />);
  expect(screen.getByText("Login page")).toBeInTheDocument();
});

test("shows the exercise list for the signed-in user", () => {
  mockSession({ data: { user: { email: "reviewer1@example.com" } }, isPending: false });
  render(<App />);
  expect(screen.getByText("Exercise list for reviewer1@example.com")).toBeInTheDocument();
});
