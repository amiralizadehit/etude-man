import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { InsufficientCreditsError, pollUpload, startUpload } from "@/lib/api";
import { preparePhoto } from "@/upload/preparePhoto";
import UploadPage, { POLL_INTERVAL_MS } from "./UploadPage";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  startUpload: vi.fn(),
  pollUpload: vi.fn(),
}));
vi.mock("@/upload/preparePhoto", () => ({
  preparePhoto: vi.fn(async () => ({ base64: "SMALLJPEG", filename: "photo.jpg" })),
}));

const PHOTO = new File(["fake image bytes"], "IMG_0042.jpg", { type: "image/jpeg" });

function renderUploadPage() {
  render(
    <MemoryRouter initialEntries={["/upload"]}>
      <Routes>
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/exercises/:exerciseId" element={<p>Practice page</p>} />
      </Routes>
    </MemoryRouter>,
  );
  return userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
}

async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>, name = "Week 3 scales") {
  await user.type(screen.getByLabelText("Exercise name"), name);
  await user.upload(screen.getByLabelText("Photo of the exercise page"), PHOTO);
  await user.click(screen.getByRole("button", { name: "Upload" }));
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.mocked(startUpload).mockReset().mockResolvedValue("upload-1");
  vi.mocked(pollUpload).mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

test("asks for the exercise name and a photo; Upload waits for a photo", async () => {
  const user = renderUploadPage();
  expect(screen.getByRole("heading", { name: "Upload a photo" })).toBeInTheDocument();
  expect(screen.getByLabelText("Exercise name")).toBeRequired();
  expect(screen.getByLabelText("Photo of the exercise page")).toHaveAttribute("type", "file");
  expect(screen.getByRole("button", { name: "Upload" })).toBeDisabled();
  await user.upload(screen.getByLabelText("Photo of the exercise page"), PHOTO);
  expect(screen.getByRole("button", { name: "Upload" })).toBeEnabled();
  expect(screen.getByRole("link", { name: "← Back to exercises" })).toHaveAttribute("href", "/");
});

test("uploads the downscaled photo with the trimmed name", async () => {
  vi.mocked(pollUpload).mockResolvedValue({ status: "done", exerciseId: "ex-9" });
  const user = renderUploadPage();
  await fillAndSubmit(user, "  Week 3 scales  ");
  expect(preparePhoto).toHaveBeenCalledWith(PHOTO);
  expect(startUpload).toHaveBeenCalledWith({ name: "Week 3 scales", image: { base64: "SMALLJPEG", filename: "photo.jpg" } });
});

test("shows Flat's progress, then opens the new exercise in practice mode", async () => {
  vi.mocked(pollUpload)
    .mockResolvedValueOnce({ status: "processing", percent: 42, stage: "Reading notes" })
    .mockResolvedValueOnce({ status: "done", exerciseId: "ex-9" });
  const user = renderUploadPage();
  await fillAndSubmit(user);

  expect(await screen.findByRole("status")).toHaveTextContent("Reading notes — 42%");
  expect(screen.getByRole("button", { name: "Upload" })).toBeDisabled();
  await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS));
  expect(await screen.findByText("Practice page")).toBeInTheDocument();
});

test("explains when the Flat account is out of credits, and offers a retry", async () => {
  vi.mocked(startUpload).mockRejectedValue(new InsufficientCreditsError("402"));
  const user = renderUploadPage();
  await fillAndSubmit(user);
  expect(await screen.findByRole("alert")).toHaveTextContent("Your Flat account doesn't have enough credits to read this photo.");
  expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
});

test("shows the reason when Flat can't read the photo, and keeps the form for a retry", async () => {
  vi.mocked(pollUpload).mockResolvedValue({ status: "error", message: "Flat couldn't read this photo." });
  const user = renderUploadPage();
  await fillAndSubmit(user);
  expect(await screen.findByRole("alert")).toHaveTextContent("Flat couldn't read this photo.");
  expect(screen.getByLabelText("Exercise name")).toHaveValue("Week 3 scales");

  vi.mocked(pollUpload).mockResolvedValue({ status: "done", exerciseId: "ex-10" });
  await user.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByText("Practice page")).toBeInTheDocument();
  expect(startUpload).toHaveBeenCalledTimes(2);
});

test("says so when the upload itself fails", async () => {
  vi.mocked(startUpload).mockRejectedValue(new Error("network"));
  const user = renderUploadPage();
  await fillAndSubmit(user);
  expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't upload the photo. Please try again.");
});

test("keeps polling through a brief network failure", async () => {
  vi.mocked(pollUpload)
    .mockRejectedValueOnce(new Error("blip"))
    .mockResolvedValueOnce({ status: "done", exerciseId: "ex-9" });
  const user = renderUploadPage();
  await fillAndSubmit(user);
  await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS));
  expect(await screen.findByText("Practice page")).toBeInTheDocument();
});

test("gives up after repeated polling failures", async () => {
  vi.mocked(pollUpload).mockRejectedValue(new Error("server down"));
  const user = renderUploadPage();
  await fillAndSubmit(user);
  await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3));
  expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't upload the photo. Please try again.");
});
