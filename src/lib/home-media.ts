/**
 * Homepage hero video. Leave a value null until the business supplies the footage; the hero then shows a neutral placeholder.
 * Files can live in /public (e.g. "/media/hero-1080.mp4") or on any HTTPS host.
 *  - desktop: about 10–20 s, H.264 MP4, ~3–6 MB, no sound, loops cleanly
 *  - mobile: the same clip at a smaller size, ~1–2 MB
 *  - poster: a still frame (JPG/WebP) shown while loading and to visitors who prefer reduced motion
 */
export const HERO_VIDEO: { desktop: string | null; mobile: string | null; poster: string | null } = {
  // The workshop footage: 1280x720 for computers (3.8 MB), 640x360 for phones (0.9 MB), no sound; both made from the owner's HDR phone clip (the second clip, TSXPE1193).
  desktop: "/media/hero2-1280.mp4",
  mobile: "/media/hero2-640.mp4",
  poster: "/media/hero2-poster.jpg",
};

/** Gallery page hero video. Same rules as above: leave null until the footage is supplied. */
export const GALLERY_VIDEO: { desktop: string | null; mobile: string | null; poster: string | null } = {
  desktop: null,
  mobile: null,
  poster: null,
};

/** Premium range page hero video. Same rules as above: leave null until the footage is supplied. */
export const PREMIUM_VIDEO: { desktop: string | null; mobile: string | null; poster: string | null } = {
  desktop: null,
  mobile: null,
  poster: null,
};
