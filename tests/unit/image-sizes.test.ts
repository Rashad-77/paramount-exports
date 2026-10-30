import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";
import { BANNER_WIDTHS, IMAGE_DEVICE_SIZES, IMAGE_SMALL_SIZES, WARM_WIDTHS, pickWindow, warmTargets } from "@/lib/image-sizes";

describe("image sizes", () => {
  it("match the sizes in next.config.ts", () => {
    expect(nextConfig.images?.deviceSizes).toEqual([...IMAGE_DEVICE_SIZES]);
    expect(nextConfig.images?.imageSizes).toEqual([...IMAGE_SMALL_SIZES]);
  });

  it("only warm widths Next.js will actually serve", () => {
    const allowed = new Set<number>([...IMAGE_DEVICE_SIZES, ...IMAGE_SMALL_SIZES]);
    for (const w of WARM_WIDTHS) expect(allowed.has(w)).toBe(true);
  });
});

describe("pickWindow", () => {
  const items = Array.from({ length: 100 }, (_, i) => i);

  it("takes everything when there is no more than one day's share", () => {
    expect(pickWindow([1, 2, 3], 5, 40)).toEqual([1, 2, 3]);
  });

  it("gives the same share all day and moves on tomorrow", () => {
    expect(pickWindow(items, 0, 40)).toEqual(items.slice(0, 40));
    expect(pickWindow(items, 1, 40)).toEqual(items.slice(40, 80));
  });

  it("wraps round the end, and reaches every item within ceil(n / share) days", () => {
    expect(pickWindow(items, 2, 40)).toEqual([...items.slice(80, 100), ...items.slice(0, 20)]);
    const seen = new Set<number>();
    for (let day = 0; day < Math.ceil(100 / 40); day++) pickWindow(items, day, 40).forEach((x) => seen.add(x));
    expect(seen.size).toBe(100);
  });
});

describe("warmTargets", () => {
  it("builds one /_next/image address per photograph per width, in the form next/image uses", () => {
    const photo = "https://abc.supabase.co/storage/v1/object/public/public-media/catalogue/2026/10/a b.png";
    const out = warmTargets("https://example.lk/", [photo]);
    expect(out).toHaveLength(WARM_WIDTHS.length);
    expect(out[0]).toBe(`https://example.lk/_next/image?url=${encodeURIComponent(photo)}&w=${WARM_WIDTHS[0]}&q=75`);
  });

  it("uses the widths it is given, and every one of them is a width next/image will really serve", () => {
    expect(warmTargets("https://example.lk", ["https://x.co/a.jpg"], BANNER_WIDTHS)).toHaveLength(BANNER_WIDTHS.length);
    const served: readonly number[] = [...IMAGE_DEVICE_SIZES, ...IMAGE_SMALL_SIZES];
    for (const w of [...WARM_WIDTHS, ...BANNER_WIDTHS]) expect(served).toContain(w);
  });

  it("does nothing for no photographs", () => {
    expect(warmTargets("https://example.lk", [])).toEqual([]);
  });
});
