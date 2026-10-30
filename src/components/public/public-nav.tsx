"use client";

import { Menu, User, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { CartLink } from "./cart-link";
import { refreshAccount, useAccount } from "./use-account";

export interface NavLink {
  label: string;
  href: string;
}

/** On a tablet these three leave the bar and sit in the menu (hamburger) instead. On a phone every link is in the menu; on a computer every link is in the bar. */
const IN_MENU_ON_TABLET = new Set(["/help", "/about", "/track"]);

/**
 * The public header: a floating pill that firms up once the page has scrolled, with a drop-down
 * menu on narrow screens (closes on Escape, on a link tap and on route change).
 */
export function PublicHeader({ name, links, accountHref }: { name: string; links: NavLink[]; accountHref: string }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const path = usePathname();
  const id = useId();
  // When a customer is signed in and has a picture (uploaded, or from Google), it replaces the plain account icon.
  const me = useAccount(accountHref === "/account");
  // Whenever the visitor moves to another page, ask again who is signed in: an account deleted (or one just signed in to) shows in the header at once, without a refresh.
  const firstPage = useRef(true);
  useEffect(() => {
    if (firstPage.current) {
      firstPage.current = false;
      return;
    }
    if (accountHref === "/account") refreshAccount();
  }, [path, accountHref]);
  const [first = name, ...others] = name.trim().split(/\s+/);
  const rest = others.join(" ");

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setScrolled(window.scrollY > 24));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <div className="head-back" aria-hidden="true" />
    <header className={"phead" + (scrolled ? " scrolled" : "") + (open ? " open" : "")}>
      <div className="in">
        <Link href="/" className="logo" aria-label={`${name} — home`} onClick={() => setOpen(false)}>
          <Image src="/logo-mark.png" alt="" width={44} height={44} priority className="mark" />
          <span className="name">
            <b>{first}</b>
            {rest ? <i>{rest}</i> : null}
          </span>
        </Link>
        <button type="button" className="toggle" aria-expanded={open} aria-controls={`${id} ${id}-more`} aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen((v) => !v)}>
          {open ? <X aria-hidden="true" className="size-4" strokeWidth={1.5} /> : <Menu aria-hidden="true" className="size-4" strokeWidth={1.5} />}
        </button>
        <nav id={id} aria-label="Primary" onClick={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)}>
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={IN_MENU_ON_TABLET.has(l.href) ? "nav-more" : undefined} aria-current={path === l.href || path.startsWith(`${l.href}/`) ? "page" : undefined}>
              {l.label}
            </Link>
          ))}
        </nav>
        <div id={`${id}-more`} className="more-menu" role="navigation" aria-label="More" onClick={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)}>
          {links
            .filter((l) => IN_MENU_ON_TABLET.has(l.href))
            .map((l) => (
              <Link key={l.href} href={l.href} aria-current={path === l.href || path.startsWith(`${l.href}/`) ? "page" : undefined}>
                {l.label}
              </Link>
            ))}
        </div>
        <CartLink onClick={() => setOpen(false)} />
        <Link href={accountHref} className="cart acct" aria-label="Account" onClick={() => setOpen(false)}>
          {me?.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={me.avatar} alt="" referrerPolicy="no-referrer" className="acct-pic" />
          ) : (
            <User aria-hidden="true" className="size-4" strokeWidth={1.5} />
          )}
        </Link>
      </div>
    </header>
    </>
  );
}
