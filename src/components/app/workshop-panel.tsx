import Link from "next/link";
import { Panel } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status";
import { FLOW, STAGE_LABEL, STAGE_TONE, type JobStage } from "@/lib/production";

/** Active custom jobs by stage, plus how many are past their due date. Counts only — no placeholder data. */
export function WorkshopPanel({ byStage, overdue, active, own }: { byStage: Record<string, number>; overdue: number; active: number; own: boolean }) {
  const stages: JobStage[] = [...FLOW.slice(0, -1), "on_hold"];
  return (
    <Panel title={own ? "My jobs" : "Custom jobs in the workshop"} description={active === 0 ? "No active jobs." : `${active} active ${active === 1 ? "job" : "jobs"}${overdue ? `, ${overdue} overdue` : ""}.`} actions={<Link className="inline-flex min-h-10 items-center text-sm underline" href="/app/production">Open board</Link>}>
      {active === 0 ? (
        <p className="text-sm text-text-muted">{own ? "Nothing is assigned to you right now." : "Confirm a custom order to start a job."}</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {stages.filter((s) => byStage[s]).map((s) => (
            <li key={s} className="flex items-center justify-between gap-3 border border-border px-3 py-2 text-sm">
              <StatusBadge tone={STAGE_TONE[s]}>{STAGE_LABEL[s]}</StatusBadge>
              <span className="tabular font-semibold">{byStage[s]}</span>
            </li>
          ))}
        </ul>
      )}
      {overdue > 0 ? <p className="mt-3"><StatusBadge tone="danger">{overdue} overdue</StatusBadge></p> : null}
    </Panel>
  );
}
