import type { ReactNode } from "react";
import { ModuleTabs } from "@/components/app/module-tabs";
import { getActor } from "@/lib/auth/session";
import { moduleInfo, visibleModuleFor } from "@/lib/nav";

/** Standard internal page title block: one h1, optional description, actions aligned right on wide screens. */
export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold leading-tight text-walnut md:text-[1.375rem]">{title}</h1>
        {description ? <p className="mt-0.5 max-w-prose text-[0.8125rem] text-text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

/** Page title for a navigation screen: the module's name and description, so the header and the sidebar always agree. */
export async function ModuleHeader({ href, title, description, actions }: { href: string; title?: string; description?: string; actions?: ReactNode }) {
  const m = moduleInfo(href);
  const actor = await getActor().catch(() => null);
  const tabs = actor ? visibleModuleFor(actor, href) : null;
  return (
    <>
      <PageHeader title={title ?? m.title} description={description} actions={actions} />
      {tabs ? <ModuleTabs label={tabs.label} pages={tabs.pages} current={href} /> : null}
    </>
  );
}

/** Content block with a thin border. Prefer this to ad-hoc bordered divs. */
export function Panel({ title, description, children, actions }: { title?: string; description?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="flex h-full min-w-0 flex-col border border-border bg-surface">
      {title ? (
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-walnut">{title}</h2>
            {description ? <p className="mt-0.5 text-xs text-text-muted">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className="flex-1 p-4">{children}</div>
    </section>
  );
}
