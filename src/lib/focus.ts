import type { CSSProperties } from "react";

/** Where a picture sits in its frame (percent from the left and from the top) and how far it is zoomed in (100 = fills the frame, up to 300). */
export interface Focus {
  x: number;
  y: number;
  z?: number;
}

export const MIN_ZOOM = 100;
export const MAX_ZOOM = 300;

/**
 * The style for a picture that fills its frame (absolute, object-fit: cover, in a frame that hides what overflows). The picture is made
 * larger by the zoom and shifted so the chosen point stays where it was: it looks the same in a small frame as in a large one.
 */
export function focusStyle(f: Focus): CSSProperties {
  const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, f.z ?? MIN_ZOOM)) / 100;
  const base: CSSProperties = { objectPosition: `${f.x}% ${f.y}%` };
  if (z === 1) return base;
  return { ...base, width: `${z * 100}%`, height: `${z * 100}%`, left: `${-(z - 1) * f.x}%`, top: `${-(z - 1) * f.y}%`, right: "auto", bottom: "auto" };
}
