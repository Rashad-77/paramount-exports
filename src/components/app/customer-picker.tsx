import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/states";
import type { Actor } from "@/lib/auth/permissions";
import { listCustomers } from "@/server/customers";

/** Step 1 of "new quotation / new order": find the customer (nothing is created until one is chosen). */
export async function CustomerPicker({ actor, basePath, q, extraParams }: { actor: Actor; basePath: string; q?: string; extraParams?: Record<string, string> }) {
  const results = q ? await listCustomers(actor, { q, page: 1, pageSize: 8 }) : null;
  const href = (id: string) => {
    const u = new URLSearchParams({ ...extraParams, customerId: id });
    return `${basePath}?${u}`;
  };
  return (
    <div className="space-y-6">
      <form method="get" action={basePath} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        {Object.entries(extraParams ?? {}).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <TextField label="Find the customer" name="q" type="search" showOptional={false} defaultValue={q} placeholder="Name, company, phone or email" className="flex-1" />
        <Button type="submit">Search</Button>
      </form>
      {results ? (
        results.rows.length === 0 ? (
          <EmptyState title="No customers match" description="Check the spelling or try the phone number. New customers are added under Customers." action={<Link className="underline" href="/app/customers/new">Add a customer</Link>} />
        ) : (
          <ul className="divide-y divide-border border border-border bg-surface">
            {results.rows.map((c) => (
              <li key={c.id}>
                <Link href={href(c.id)} className="flex min-h-14 flex-col justify-center px-4 py-2 hover:bg-linen">
                  <span className="font-medium">{c.name}</span>
                  <span className="text-sm text-text-muted">{[c.company, c.phone, c.email].filter(Boolean).join(" · ")}</span>
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : (
        <p className="text-sm text-text-muted">Search for the customer this is for. You will be asked to add them first if they are new.</p>
      )}
    </div>
  );
}
