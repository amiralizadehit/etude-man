import { MAX_PHOTO_EDGE_PX, scaledSize } from "./preparePhoto";

test("scales a large landscape photo so the long edge fits", () => {
  expect(scaledSize(4032, 3024)).toEqual({ width: MAX_PHOTO_EDGE_PX, height: 1800 });
});

test("scales a large portrait photo so the long edge fits", () => {
  expect(scaledSize(3024, 4032)).toEqual({ width: 1800, height: MAX_PHOTO_EDGE_PX });
});

test("never scales a small photo up", () => {
  expect(scaledSize(1200, 900)).toEqual({ width: 1200, height: 900 });
});
