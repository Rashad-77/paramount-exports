import type { ReactNode } from "react";

/** Standard internal page title block: one h1, optional description, actions aligned right on wide screens. */
export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="font-display text-[2rem] leading-tight text-walnut md:text-[2.5rem]">{title}</h1>
        {description ? <p className="mt-2 max-w-prose text-sm text-text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

/** Content block with a thin border. Prefer this to ad-hoc bordered divs. */
export function Panel({ title, description, children, actions }: { title?: string; description?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="min-w-0 border border-border bg-surface">
      {title ? (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-[0.8125rem] font-semibold uppercase tracking-[0.12em] text-walnut">{title}</h2>
            {description ? <p className="mt-0.5 text-sm text-text-muted">{description}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className="p-5">{children}</div>
    </section>
  );
}
