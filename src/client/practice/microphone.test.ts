import { rootMeanSquare } from "./microphone";

describe("rootMeanSquare", () => {
  test("is 0 for silence and for an empty buffer", () => {
    expect(rootMeanSquare(new Float32Array(1024))).toBe(0);
    expect(rootMeanSquare([])).toBe(0);
  });

  test("is the amplitude for a constant signal, whatever its sign", () => {
    expect(rootMeanSquare([0.5, -0.5, 0.5, -0.5])).toBeCloseTo(0.5);
  });

  test("is amplitude / √2 for a full-cycle sine wave", () => {
    const sine = Array.from({ length: 1000 }, (_, i) => 0.8 * Math.sin((2 * Math.PI * i) / 1000));
    expect(rootMeanSquare(sine)).toBeCloseTo(0.8 / Math.SQRT2, 3);
  });
});
