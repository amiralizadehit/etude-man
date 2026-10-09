import { render, screen } from "@testing-library/react";
import App from "./App";

test("shows the app name", () => {
  render(<App />);
  expect(screen.getByRole("heading", { name: "Etude Man" })).toBeInTheDocument();
});
