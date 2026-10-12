import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/cn";

/** Scrollable wrapper: keyboard-focusable so overflowing tables can be scrolled without a mouse. */
export function TableWrap({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className={cn("relative overflow-x-auto border border-border bg-surface", className)}
    >
      {children}
    </div>
  );
}

export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return <table className={cn("w-full border-collapse text-left text-sm", className)} {...props} />;
}

export function THead(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className="border-b border-border bg-paper-deep" {...props} />;
}

export function TR({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("border-b border-border transition-colors duration-[var(--duration-fast)] last:border-b-0 hover:bg-paper-deep/70", className)} {...props} />;
}

export function TH({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th scope="col" className={cn("px-4 py-3 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-text-muted whitespace-nowrap", className)} {...props} />
  );
}

export function TD({ className, numeric, ...props }: TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return <td className={cn("px-4 py-3 align-middle", numeric && "tabular text-right", className)} {...props} />;
}

/** Sortable column header: a real link so sorting works without JavaScript and is shareable. */
export function SortHeader({
  label,
  href,
  direction,
  className,
}: {
  label: string;
  href: string;
  direction?: "asc" | "desc";
  className?: string;
}) {
  const Icon = direction === "asc" ? ArrowUp : direction === "desc" ? ArrowDown : ChevronsUpDown;
  return (
    <th
      scope="col"
      aria-sort={direction === "asc" ? "ascending" : direction === "desc" ? "descending" : "none"}
      className={cn("px-4 py-3 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-text-muted whitespace-nowrap", className)}
    >
      <Link href={href} className="inline-flex items-center gap-1 hover:text-text">
        {label}
        <Icon aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
      </Link>
    </th>
  );
}

/** Previous / next pagination driven by URL params (server-rendered, no client state). */
export function Pagination({
  page,
  pageCount,
  hrefFor,
}: {
  page: number;
  pageCount: number;
  hrefFor: (page: number) => string;
}) {
  if (pageCount <= 1) return null;
  const linkClass =
    "inline-flex min-h-10 items-center border border-border-strong px-3 text-sm hover:bg-linen";
  const disabledClass = "inline-flex min-h-10 items-center border border-border px-3 text-sm text-text-muted opacity-60";
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between gap-3">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} rel="prev" className={linkClass}>
          Previous
        </Link>
      ) : (
        <span aria-disabled="true" className={disabledClass}>
          Previous
        </span>
      )}
      <p className="text-sm text-text-muted">
        Page {page} of {pageCount}
      </p>
      {page < pageCount ? (
        <Link href={hrefFor(page + 1)} rel="next" className={linkClass}>
          Next
        </Link>
      ) : (
        <span aria-disabled="true" className={disabledClass}>
          Next
        </span>
      )}
    </nav>
  );
}
