// Phone photos are often 3–8 MB, above the host's request size limit (TECH_SPEC, Architecture).
// Downscale and re-encode as JPEG in the browser, keeping enough resolution for OMR.

export const MAX_PHOTO_EDGE_PX = 2400;
const JPEG_QUALITY = 0.85;

export type PreparedPhoto = { base64: string; filename: string };

/** Scales (width, height) down so the longer edge is at most `maxEdge`; never scales up. */
export function scaledSize(width: number, height: number, maxEdge = MAX_PHOTO_EDGE_PX): { width: number; height: number } {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  // Respects the photo's EXIF orientation, so phone pictures aren't sideways.
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const { width, height } = scaledSize(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  return { base64: dataUrl.slice(dataUrl.indexOf(",") + 1), filename: "photo.jpg" };
}
