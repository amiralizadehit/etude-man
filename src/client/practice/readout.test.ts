import { createReadoutSmoother, READOUT_HOLD_MS, READOUT_UPDATE_MS } from "./readout";

const A4 = { noteName: "A4", cents: 2 };
const A4_SHARPER = { noteName: "A4", cents: 9 };
const C5 = { noteName: "C5", cents: -4 };

test("shows the first clear reading straight away", () => {
  expect(createReadoutSmoother().next(A4, 0)).toEqual(A4);
});

test("updates at most once per update interval", () => {
  const smoother = createReadoutSmoother();
  smoother.next(A4, 0);
  expect(smoother.next(A4_SHARPER, 16)).toEqual(A4);
  expect(smoother.next(C5, READOUT_UPDATE_MS - 1)).toEqual(A4);
  expect(smoother.next(C5, READOUT_UPDATE_MS)).toEqual(C5);
});

test("keeps the last clear reading through a brief gap", () => {
  const smoother = createReadoutSmoother();
  smoother.next(A4, 0);
  expect(smoother.next(null, 100)).toEqual(A4);
  expect(smoother.next(null, READOUT_HOLD_MS)).toEqual(A4);
});

test("clears after the hold time with no clear reading", () => {
  const smoother = createReadoutSmoother();
  smoother.next(A4, 0);
  expect(smoother.next(null, READOUT_HOLD_MS + 1)).toBeNull();
});

test("reset forgets what was shown", () => {
  const smoother = createReadoutSmoother();
  smoother.next(A4, 0);
  smoother.reset();
  expect(smoother.next(null, 10)).toBeNull();
});
