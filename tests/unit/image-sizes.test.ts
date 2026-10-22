import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";
import { IMAGE_DEVICE_SIZES, IMAGE_SMALL_SIZES, WARM_WIDTHS, warmTargets } from "@/lib/image-sizes";

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

describe("warmTargets", () => {
  it("builds one /_next/image address per photograph per width, in the form next/image uses", () => {
    const photo = "https://abc.supabase.co/storage/v1/object/public/public-media/catalogue/2026/10/a b.png";
    const out = warmTargets("https://example.lk/", [photo]);
    expect(out).toHaveLength(WARM_WIDTHS.length);
    expect(out[0]).toBe(`https://example.lk/_next/image?url=${encodeURIComponent(photo)}&w=${WARM_WIDTHS[0]}&q=75`);
  });

  it("does nothing for no photographs", () => {
    expect(warmTargets("https://example.lk", [])).toEqual([]);
  });
});
