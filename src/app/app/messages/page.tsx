import Link from "next/link";
import { Button, ButtonLink } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { ModuleHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status";
import { Pagination, Table, TableWrap, TD, TH, THead, TR } from "@/components/ui/table";
import { requireActor } from "@/lib/auth/session";
import { buildHref, one, oneOf, pageOf, type SP } from "@/lib/list-params";
import { MESSAGE_KIND_LABEL } from "@/lib/order-ui";
import { getBusinessSettings } from "@/lib/settings";
import { formatDateTime } from "@/lib/time";
import { listMessages } from "@/server/messages";

export const metadata = { title: "Messages" };
const PAGE_SIZE = 20;

export default async function MessagesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  const state = oneOf(one(sp.state), ["open", "handled"] as const);
  const q = one(sp.q)?.slice(0, 80);
  const page = pageOf(sp);
  const [business, result] = await Promise.all([getBusinessSettings(), listMessages(actor, { state, q, page, pageSize: PAGE_SIZE })]);
  const href = (over: Record<string, string | undefined>) => buildHref("/app/messages", { state, q, ...over });
  const tabs = [
    { key: undefined, label: "All" },
    { key: "open", label: `Open${result.open ? ` (${result.open})` : ""}` },
    { key: "handled", label: "Handled" },
  ];

  return (
    <>
      <ModuleHeader href="/app/messages" />
      <nav aria-label="Message state" className="mb-5 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Link
            key={t.label}
            href={buildHref("/app/messages", { state: t.key, q })}
            aria-current={state === t.key ? "page" : undefined}
            className={"inline-flex min-h-10 items-center border px-3.5 text-sm " + (state === t.key ? "border-brand bg-brand font-semibold text-white" : "border-border-strong text-text-muted hover:text-text")}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <form method="get" className="mb-6 flex flex-wrap items-end gap-3 border border-border bg-surface p-4">
        {state ? <input type="hidden" name="state" value={state} /> : null}
        <TextField showOptional={false} label="Search" name="q" type="search" defaultValue={q} placeholder="Name, phone, email or words in the message" className="min-w-64 flex-1" />
        <Button type="submit">Search</Button>
        {q ? (
          <ButtonLink href={href({ q: undefined })} variant="ghost">
            Clear
          </ButtonLink>
        ) : null}
      </form>

      {result.rows.length === 0 ? (
        <EmptyState title={q || state ? "No messages match" : "No messages yet"} description={q || state ? "Try a different tab or search." : "Messages sent from the website will appear here."} />
      ) : (
        <TableWrap label="Messages">
          <Table>
            <THead>
              <tr>
                <TH>Message</TH>
                <TH>From</TH>
                <TH className="hidden md:table-cell">Type</TH>
                <TH className="hidden lg:table-cell">Received</TH>
              </tr>
            </THead>
            <tbody>
              {result.rows.map((r) => (
                <TR key={r.id}>
                  <TD>
                    <Link href={`/app/messages/${r.id}`} className="font-medium text-walnut underline">
                      {r.reference}
                    </Link>
                    <div className="mt-0.5 line-clamp-1 max-w-md text-text-muted">{r.message ?? "—"}</div>
                  </TD>
                  <TD>
                    <div className="font-medium">{r.name}</div>
                    <div className="text-text-muted">{r.phone}</div>
                    <div className="mt-1">{r.isHandled ? <StatusBadge tone="success">Handled</StatusBadge> : <StatusBadge tone="info">Open</StatusBadge>}</div>
                  </TD>
                  <TD className="hidden md:table-cell">{MESSAGE_KIND_LABEL[r.kind] ?? r.kind}</TD>
                  <TD className="hidden whitespace-nowrap lg:table-cell">{formatDateTime(r.createdAt, business.timezone)}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      )}
      <Pagination page={page} pageCount={result.pageCount} hrefFor={(n) => href({ page: String(n) })} />
    </>
  );
}
