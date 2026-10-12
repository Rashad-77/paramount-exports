import { Button, ButtonLink } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/field";
import { ActionForm, FField } from "@/components/forms/action-form";
import { ConfirmSubmit } from "@/components/forms/confirm-submit";
import { ModuleHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status";
import { Pagination, Table, TableWrap, TD, TH, THead, TR } from "@/components/ui/table";
import { can } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { addDaysLocal, formatDate, todayLocal } from "@/lib/time";
import { buildHref, one, pageOf, type SP } from "@/lib/list-params";
import { formatMoney } from "@/lib/money";
import { PAYMENT_METHOD_LABEL } from "@/lib/schemas/orders";
import { getBusinessSettings } from "@/lib/settings";
import { listExpenseCategories, listExpenses } from "@/server/expenses";
import { voidExpenseAction } from "./actions";

export const metadata = { title: "Expenses" };

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  const business = await getBusinessSettings();
  const iso = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
  const from = iso(one(sp.from)) ?? addDaysLocal(-29, business.timezone);
  const to = iso(one(sp.to)) ?? todayLocal(business.timezone);
  const categoryId = one(sp.category);
  const q = one(sp.q)?.slice(0, 80);
  const voided = one(sp.voided) === "1";
  const page = pageOf(sp);
  const [cats, result] = await Promise.all([listExpenseCategories(actor, true), listExpenses(actor, { from, to, categoryId, q, includeVoided: voided, page, pageSize: 25 })]);
  const cur = business.currency;
  return (
    <>
      <ModuleHeader href="/app/expenses" actions={
          <>
            {can(actor, "expenses:manage_categories") ? <ButtonLink href="/app/expenses/categories" variant="secondary">Categories</ButtonLink> : null}
            {can(actor, "expenses:write") ? <ButtonLink href="/app/expenses/new">Record an expense</ButtonLink> : null}
          </>
        } />
      <form method="get" className="mb-6 grid gap-4 border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-6 lg:items-end">
        <TextField label="From" name="from" type="date" showOptional={false} defaultValue={from} />
        <TextField label="To" name="to" type="date" showOptional={false} defaultValue={to} />
        <SelectField label="Category" name="category" showOptional={false} defaultValue={categoryId ?? ""} placeholder="All" options={cats.map((c) => ({ value: c.id, label: c.name }))} />
        <TextField label="Search" name="q" type="search" showOptional={false} defaultValue={q} placeholder="What, who or reference" className="lg:col-span-2" />
        <label className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" name="voided" value="1" defaultChecked={voided} className="size-5 accent-[var(--color-walnut)]" /> Show voided</label>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-6"><Button type="submit">Apply</Button></div>
      </form>
      <p className="mb-3 text-sm" role="status"><span className="text-text-muted">{formatDate(from, business.timezone)} – {formatDate(to, business.timezone)} · {result.total} {result.total === 1 ? "entry" : "entries"} · Total (excluding voided) </span><span className="tabular font-semibold">{formatMoney(result.totalAmount, cur)}</span></p>
      {result.rows.length === 0 ? (
        <EmptyState title="No expenses in this period" description="Change the dates, or record an expense." />
      ) : (
        <TableWrap label="Expenses">
          <Table>
            <THead><tr><TH>Date</TH><TH>What</TH><TH className="hidden md:table-cell">Category</TH><TH className="hidden lg:table-cell">Paid by</TH><TH className="text-right">Amount</TH><TH>Action</TH></tr></THead>
            <tbody>
              {result.rows.map((r) => (
                <TR key={r.id} className={r.voidedAt ? "opacity-70" : undefined}>
                  <TD className="whitespace-nowrap">{formatDate(r.spentOn, business.timezone)}</TD>
                  <TD>
                    <span className={r.voidedAt ? "line-through" : "font-medium"}>{r.description}</span>
                    <span className="block text-xs text-text-muted">{[r.payee, r.reference].filter(Boolean).join(" · ")}{r.files > 0 ? ` · ${r.files} attachment${r.files > 1 ? "s" : ""}` : ""}</span>
                    {r.voidedAt ? <span className="block text-xs text-danger">Voided: {r.voidReason}</span> : null}
                  </TD>
                  <TD className="hidden md:table-cell">{r.categoryName}</TD>
                  <TD className="hidden lg:table-cell">{PAYMENT_METHOD_LABEL[r.method]}<span className="block text-xs text-text-muted">{r.byName ?? ""}</span></TD>
                  <TD numeric>{formatMoney(r.amount, cur)}</TD>
                  <TD>
                    {r.voidedAt ? <StatusBadge tone="neutral">Voided</StatusBadge> : can(actor, "expenses:void") ? (
                      <details>
                        <summary className="cursor-pointer text-sm underline">Void…</summary>
                        <ActionForm action={voidExpenseAction} className="mt-3 min-w-56 space-y-3">
                          <input type="hidden" name="id" value={r.id} />
                          <FField name="reason" label="Why is it being voided?" required />
                          <ConfirmSubmit title="Void this expense?" description="It stays on record, marked as voided with your reason, and is no longer counted in any total." confirmLabel="Void expense">Void expense</ConfirmSubmit>
                        </ActionForm>
                      </details>
                    ) : <StatusBadge tone="success">Recorded</StatusBadge>}
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      )}
      <Pagination page={page} pageCount={result.pageCount} hrefFor={(n) => buildHref("/app/expenses", { from, to, category: categoryId, q, voided: voided ? "1" : undefined, page: String(n) })} />
    </>
  );
}
