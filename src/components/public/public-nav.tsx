"use client";

import { Menu, User, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { CartLink } from "./cart-link";

export interface NavLink {
  label: string;
  href: string;
}

/**
 * The public header: a floating pill that firms up once the page has scrolled, with a drop-down
 * menu on narrow screens (closes on Escape, on a link tap and on route change).
 */
export function PublicHeader({ name, links, accountHref }: { name: string; links: NavLink[]; accountHref: string }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const path = usePathname();
  const id = useId();
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
        <button type="button" className="toggle" aria-expanded={open} aria-controls={id} aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen((v) => !v)}>
          {open ? <X aria-hidden="true" className="size-5" strokeWidth={1.75} /> : <Menu aria-hidden="true" className="size-5" strokeWidth={1.75} />}
        </button>
        <nav id={id} aria-label="Primary" onClick={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)}>
          {links.map((l) => (
            <Link key={l.href} href={l.href} aria-current={path === l.href || path.startsWith(`${l.href}/`) ? "page" : undefined}>
              {l.label}
            </Link>
          ))}
        </nav>
        <CartLink onClick={() => setOpen(false)} />
        <Link href={accountHref} className="cart acct" aria-label="Account" onClick={() => setOpen(false)}>
          <User aria-hidden="true" className="size-4" strokeWidth={1.5} />
        </Link>
      </div>
    </header>
    </>
  );
}
