import type { Actor } from "@/lib/auth/permissions";
import { PageHeader, Panel } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status";
import { Table, TableWrap, TD, TH, THead, TR } from "@/components/ui/table";

export interface SetupCheck {
  label: string;
  done: boolean;
  hint: string;
}
export interface LocationRow {
  id: string;
  name: string;
  kind: string;
  isActive: boolean;
}

const KIND_LABEL: Record<string, string> = { showroom: "Showroom", workshop: "Workshop", warehouse: "Warehouse" };

/**
 * Overview screen. It shows only facts that exist today (setup progress, locations, the user's access).
 * Metrics such as leads, stock and sales are added with their modules — no placeholder numbers.
 */
export function DashboardView({ actor, setup, locations }: { actor: Actor; setup: SetupCheck[]; locations: LocationRow[] }) {
  const remaining = setup.filter((s) => !s.done).length;
  const firstName = actor.fullName.split(" ")[0];

  return (
    <>
      <PageHeader
        title={`Welcome, ${firstName}`}
        description="Overview of the system. Operational dashboards appear here as each module is switched on."
      />

      <div className="grid items-start gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Panel
            title="Setup checklist"
            description={remaining === 0 ? "Everything needed to launch the public site is in place." : `${remaining} of ${setup.length} items still to do.`}
          >
            <ul className="divide-y divide-border">
              {setup.map((s) => (
                <li key={s.label} className="flex flex-col items-start gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <div>
                    <p className="text-sm font-medium">{s.label}</p>
                    <p className="text-sm text-text-muted">{s.hint}</p>
                  </div>
                  <StatusBadge tone={s.done ? "success" : "warning"}>{s.done ? "Done" : "To do"}</StatusBadge>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <Panel title="Your access">
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-text-muted">Name</dt>
              <dd className="font-medium">{actor.fullName}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Roles</dt>
              <dd className="mt-1 flex flex-wrap gap-1.5">
                {actor.roles.map((r) => (
                  <StatusBadge key={r} tone="neutral" className="capitalize">
                    {r}
                  </StatusBadge>
                ))}
              </dd>
            </div>
          </dl>
        </Panel>

        <div className="xl:col-span-3">
          <Panel title="Locations" description="Stock is tracked separately for each location.">
            <TableWrap label="Locations">
              <Table>
                <THead>
                  <tr>
                    <TH>Name</TH>
                    <TH>Type</TH>
                    <TH>Status</TH>
                  </tr>
                </THead>
                <tbody>
                  {locations.map((l) => (
                    <TR key={l.id}>
                      <TD className="font-medium">{l.name}</TD>
                      <TD>{KIND_LABEL[l.kind] ?? l.kind}</TD>
                      <TD>
                        <StatusBadge tone={l.isActive ? "success" : "neutral"}>{l.isActive ? "Active" : "Inactive"}</StatusBadge>
                      </TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          </Panel>
        </div>
      </div>
    </>
  );
}
