import Link from "next/link";
import { Button, ButtonLink } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/field";
import { ModuleHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status";
import { Pagination, Table, TableWrap, TD, TH, THead, TR } from "@/components/ui/table";
import { can } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { buildHref, one, oneOf, pageOf, type SP } from "@/lib/list-params";
import { ITEM_KINDS, ITEM_KIND_LABEL } from "@/lib/schemas/inventory";
import { listStock } from "@/server/inventory";

const q3 = (v: string) => String(Number(v));

export async function StockView({ searchParams, materials = false }: { searchParams: Promise<SP>; materials?: boolean }) {
  const actor = await requireActor();
  const sp = await searchParams;
  const q = one(sp.q)?.slice(0, 80);
  const kind = materials ? undefined : oneOf(one(sp.kind), ITEM_KINDS);
  const locationId = one(sp.location);
  const lowOnly = one(sp.low) === "1";
  const page = pageOf(sp);
  const result = await listStock(actor, { q, kind, materialsOnly: materials, locationId, lowOnly, page, pageSize: 25 });
  const shownLocations = locationId ? result.locations.filter((l) => l.id === locationId) : result.locations;
  const filtered = Boolean(q || kind || locationId || lowOnly);
  return (
    <>
      <ModuleHeader href={materials ? "/app/materials" : "/app/stock"} actions={
          <>
            {can(actor, "inventory:adjust") ? <ButtonLink href="/app/stock/new">Add stock item</ButtonLink> : null}
          </>
        }
      />
      <form method="get" className="mb-6 grid gap-4 border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
        <TextField label="Search" name="q" type="search" showOptional={false} defaultValue={q} placeholder="Name or SKU" className="lg:col-span-2" />
        {materials ? null : <SelectField label="Type" name="kind" showOptional={false} defaultValue={kind ?? ""} placeholder="All" options={ITEM_KINDS.map((k) => ({ value: k, label: ITEM_KIND_LABEL[k]! }))} />}
        <SelectField label="Location" name="location" showOptional={false} defaultValue={locationId ?? ""} placeholder="All" options={result.locations.map((l) => ({ value: l.id, label: l.name }))} />
        <label className="flex min-h-10 items-center gap-2 text-sm">
          <input type="checkbox" name="low" value="1" defaultChecked={lowOnly} className="size-5 accent-[var(--color-walnut)]" /> Low stock only
        </label>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-5">
          <Button type="submit">Apply</Button>
          {filtered ? <ButtonLink href={materials ? "/app/materials" : "/app/stock"} variant="ghost">Clear</ButtonLink> : null}
        </div>
      </form>
      <p className="mb-3 text-sm text-text-muted" role="status">{result.total} {result.total === 1 ? "item" : "items"}</p>
      {result.rows.length === 0 ? (
        <EmptyState title={filtered ? "No stock items match" : "No stock items yet"} description={filtered ? "Try clearing a filter." : "Turn on stock tracking for a product option, or add a material."} />
      ) : (
        <TableWrap label="Stock levels">
          <Table>
            <THead>
              <tr>
                <TH>Item</TH>
                {shownLocations.map((l) => (
                  <TH key={l.id} className="text-right">{l.name}<span className="block font-normal normal-case tracking-normal">on hand · reserved · available</span></TH>
                ))}
              </tr>
            </THead>
            <tbody>
              {result.rows.map((r) => (
                <TR key={r.id}>
                  <TD>
                    <Link href={`/app/stock/${r.id}`} className="font-medium text-walnut underline">{r.name}</Link>
                    <div className="text-text-muted">{r.sku} · {ITEM_KIND_LABEL[r.kind]} · {r.unit}</div>
                    {r.low ? <StatusBadge tone="warning" className="mt-1">Low stock</StatusBadge> : null}
                  </TD>
                  {shownLocations.map((l) => {
                    const b = r.byLocation[l.id];
                    return (
                      <TD key={l.id} numeric>
                        {b ? (
                          <span title={b.low ? "At or below the low-stock level" : undefined}>
                            {q3(b.onHand)} · {q3(b.reserved)} · <strong className={b.low ? "text-warning" : ""}>{q3(b.available)}</strong>
                          </span>
                        ) : (
                          <span className="text-text-muted">0 · 0 · 0</span>
                        )}
                      </TD>
                    );
                  })}
                </TR>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      )}
      <Pagination page={page} pageCount={result.pageCount} hrefFor={(n) => buildHref(materials ? "/app/materials" : "/app/stock", { q, kind: materials ? undefined : kind, location: locationId, low: lowOnly ? "1" : undefined, page: String(n) })} />
    </>
  );
}
