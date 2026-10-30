"use client";

import { useEffect } from "react";

/**
 * Puts a page at the top when it opens. After a redirect (the header's account button goes to /account, which sends a signed-out visitor on to
 * the sign-in page) the browser can keep the scroll position of the page before, and a short page then opens at its footer.
 */
export function ScrollTop() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  return null;
}
