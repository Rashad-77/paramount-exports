import type { Actor } from "@/lib/auth/permissions";
import { PageHeader, Panel } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status";
import { Table, TableWrap, TD, TH, THead, TR } from "@/components/ui/table";
import type { ReactNode } from "react";

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
 * Overview screen, in three bands: headline figures, then grouped cards (pipeline, workshop, attention, money, stock),
 * then setup and locations. It shows only facts that exist; nothing is a placeholder number.
 */
export function DashboardView({
  actor,
  setup,
  locations,
  kpis,
  insights,
  actions,
}: {
  actor: Actor;
  setup: SetupCheck[];
  locations: LocationRow[];
  kpis?: ReactNode;
  insights?: ReactNode;
  actions?: ReactNode;
}) {
  const remaining = setup.filter((s) => !s.done).length;
  const firstName = actor.fullName.split(" ")[0];

  return (
    <div className="space-y-4">
      <PageHeader title="Overview" description={`Welcome, ${firstName}. What is coming in, what is on the bench and what needs attention.`} actions={actions} />

      {kpis ? <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{kpis}</div> : null}

      {insights ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{insights}</div> : null}

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="Setup checklist" description={remaining === 0 ? "Everything needed to launch the public site is in place." : `${remaining} of ${setup.length} items still to do.`}>
          <ul className="divide-y divide-border">
            {setup.map((s) => (
              <li key={s.label} className="flex flex-col items-start gap-1.5 py-2.5 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div>
                  <p className="text-sm font-medium">{s.label}</p>
                  <p className="text-xs text-text-muted">{s.hint}</p>
                </div>
                <StatusBadge tone={s.done ? "success" : "warning"}>{s.done ? "Done" : "To do"}</StatusBadge>
              </li>
            ))}
          </ul>
        </Panel>

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
  );
}
