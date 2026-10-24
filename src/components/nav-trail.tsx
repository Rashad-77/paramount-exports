"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

const KEY = "paramount-nav-trail";
const LIMIT = 40;

const read = (): string[] => {
  try {
    const v = JSON.parse(window.sessionStorage.getItem(KEY) ?? "[]") as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
};
const write = (trail: string[]) => {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(trail.slice(-LIMIT)));
  } catch {
    // Storage can be blocked; Back then falls back to the page it was given.
  }
};
const pathOf = (url: string) => url.split("?")[0]!;

/**
 * The pages the visitor has been through in this tab, kept in session storage so it survives a reload. Next.js does not update
 * `document.referrer` when pages change without a reload, so "Back" cannot rely on it. Changing only the search or filter of a list
 * (same page, other query) replaces the last entry instead of adding one, and stepping back removes the entry you leave.
 */
export function NavTrail() {
  const path = usePathname();
  const search = useSearchParams().toString();
  const url = search ? `${path}?${search}` : path;

  useEffect(() => {
    const trail = read();
    const last = trail[trail.length - 1];
    if (last === url) return;
    if (trail.length >= 2 && trail[trail.length - 2] === url) {
      trail.pop();
    } else if (last !== undefined && pathOf(last) === path) {
      trail[trail.length - 1] = url;
    } else {
      trail.push(url);
    }
    write(trail);
  }, [url, path]);

  return null;
}

/**
 * The signed-in account pages (orders, profile, wishlist, messages, security, addresses) are sections of one place, switched with the account
 * menu. Back must never hop between them: it leaves the account for the page the visitor came from. The sign-in, forgot-password and reset
 * pages are separate pages, so they are not part of that.
 */
const accountSection = (path: string): boolean => /^\/account(\/|$)/.test(path) && !/^\/account\/(sign-in|forgot|reset|confirm)(\/|$)/.test(path);

/** The page before this one, or null when this tab has no earlier page on the site. */
export function previousPage(): string | null {
  const trail = read();
  const here = window.location.pathname;
  const inAccount = accountSection(here);
  for (let i = trail.length - 1; i >= 0; i--) {
    const p = pathOf(trail[i]!);
    if (p === here) continue;
    if (inAccount && accountSection(p)) continue;
    return trail[i]!;
  }
  return null;
}
