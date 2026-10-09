import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginPage from "./LoginPage";
import { authClient } from "@/lib/authClient";

vi.mock("@/lib/authClient", () => ({
  authClient: { signIn: { email: vi.fn() } },
}));

const signInEmail = vi.mocked(authClient.signIn.email);

async function fillAndSubmit(email: string, password: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Email"), email);
  await user.type(screen.getByLabelText("Password"), password);
  await user.click(screen.getByRole("button", { name: "Sign in" }));
}

beforeEach(() => {
  signInEmail.mockReset();
});

test("shows the email and password fields and a sign-in button", () => {
  render(<LoginPage />);
  expect(screen.getByLabelText("Email")).toBeInTheDocument();
  expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
  expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
});

test("signs in with the entered email and password", async () => {
  signInEmail.mockResolvedValue({ data: {}, error: null } as never);
  render(<LoginPage />);
  await fillAndSubmit("reviewer1@example.com", "secret-password");
  expect(signInEmail).toHaveBeenCalledWith({ email: "reviewer1@example.com", password: "secret-password" });
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test("shows a wrong-credentials message when sign-in is rejected", async () => {
  signInEmail.mockResolvedValue({ data: null, error: { status: 401, message: "Invalid" } } as never);
  render(<LoginPage />);
  await fillAndSubmit("reviewer1@example.com", "wrong");
  expect(await screen.findByRole("alert")).toHaveTextContent("Wrong email or password.");
  expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
});

test("shows a generic message for other sign-in failures", async () => {
  signInEmail.mockResolvedValue({ data: null, error: { status: 500, message: "Boom" } } as never);
  render(<LoginPage />);
  await fillAndSubmit("reviewer1@example.com", "secret-password");
  expect(await screen.findByRole("alert")).toHaveTextContent("Sign-in failed. Please try again.");
});

test("shows a generic message when the request fails to reach the server", async () => {
  signInEmail.mockRejectedValue(new TypeError("Failed to fetch"));
  render(<LoginPage />);
  await fillAndSubmit("reviewer1@example.com", "secret-password");
  expect(await screen.findByRole("alert")).toHaveTextContent("Sign-in failed. Please try again.");
  expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
});

test("disables the button while signing in", async () => {
  let finishSignIn: (value: unknown) => void = () => {};
  signInEmail.mockReturnValue(new Promise((resolve) => (finishSignIn = resolve)) as never);
  render(<LoginPage />);
  await fillAndSubmit("reviewer1@example.com", "secret-password");
  expect(screen.getByRole("button", { name: "Signing in…" })).toBeDisabled();
  finishSignIn({ data: {}, error: null });
  expect(await screen.findByRole("button", { name: "Sign in" })).toBeEnabled();
});
