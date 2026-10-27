"use client";

import { useLayoutEffect } from "react";

/** Set when the visitor went back or forward: the browser's own remembered position is kept then. */
let wentBackOrForward = false;
/** The first page of a visit is left where the browser puts it (a reload keeps its place). */
let firstPage = true;
if (typeof window !== "undefined") window.addEventListener("popstate", () => (wentBackOrForward = true));

/**
 * Every page the visitor opens by a link starts at the top, under the header. Without this a page could open scrolled to where the
 * visitor was on the last one (the footer, after pressing a link there). A link to a place on the page (#something) is left alone.
 */
export function RouteScrollTop() {
  useLayoutEffect(() => {
    if (firstPage) {
      firstPage = false;
      return;
    }
    if (wentBackOrForward) {
      wentBackOrForward = false;
      return;
    }
    if (window.location.hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, []);
  return null;
}
