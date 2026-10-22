/** The longest side a stored photograph needs: a product photo is never shown larger than about 1200 px wide, so this holds a 2x screen. */
const MAX_SIDE = 2400;
/** A photograph already inside the size limit and under this many bytes is sent as it is. */
const KEEP_BELOW = 1.2 * 1024 * 1024;
const RESIZABLE = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * Runs in the browser just before a photograph is uploaded: turns a large one into a WebP no more than 2400 px on its longest side,
 * once, so every visitor's first view fetches a small file instead of the camera original. Phone photographs are turned upright and
 * their location and camera details are dropped on the way. A photograph that is already small, or a browser that cannot do it,
 * sends the file unchanged.
 */
export async function prepareImage(file: File): Promise<File> {
  if (!RESIZABLE.has(file.type) || typeof createImageBitmap !== "function" || typeof document === "undefined") return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const longest = Math.max(bitmap.width, bitmap.height);
    if (longest <= MAX_SIDE && file.size <= KEEP_BELOW) {
      bitmap.close();
      return file;
    }
    const scale = Math.min(1, MAX_SIDE / longest);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
    // A browser that cannot write WebP hands back a PNG; a result no smaller than the original is no help either.
    if (!blob || blob.type !== "image/webp" || blob.size >= file.size) return file;
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.webp`, { type: "image/webp", lastModified: Date.now() });
  } catch {
    return file;
  }
}
