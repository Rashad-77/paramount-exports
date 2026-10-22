/**
 * The widths the site's photographs are resized to. Next.js makes (and Vercel stores) one copy per photograph per width, so a short list
 * means almost every phone and computer shares the same stored copies. Keep these in step with `images` in next.config.ts (a test checks it).
 */
export const IMAGE_DEVICE_SIZES = [640, 960, 1280, 1920] as const;
export const IMAGE_SMALL_SIZES = [96, 256, 384] as const;

/**
 * The widths worth preparing ahead of the first customer, most-used first: the product page's large photograph (640 on a computer, 960 or
 * 1280 on phones), the collection cards (640) and the thumbnail row (96, or 256 on a sharp screen).
 */
export const WARM_WIDTHS = [640, 1280, 960, 256, 96] as const;

/**
 * The share of `items` to handle on a given day when only `perRun` can be handled at a time: the same share all day, the next share
 * tomorrow, wrapping round, so every item is reached within `ceil(items.length / perRun)` days.
 */
export function pickWindow<T>(items: T[], dayIndex: number, perRun: number): T[] {
  if (items.length <= perRun) return items;
  const start = (dayIndex * perRun) % items.length;
  return Array.from({ length: perRun }, (_, i) => items[(start + i) % items.length] as T);
}

/** The addresses that make Next.js prepare each photograph at each warm width, as a browser would ask for them. */
export function warmTargets(siteUrl: string, photoUrls: string[]): string[] {
  const origin = siteUrl.replace(/\/+$/, "");
  return photoUrls.flatMap((u) => WARM_WIDTHS.map((w) => `${origin}/_next/image?url=${encodeURIComponent(u)}&w=${w}&q=75`));
}
