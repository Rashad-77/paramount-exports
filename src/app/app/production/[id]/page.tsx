import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConsumptionForm } from "@/components/app/consumption-form";
import { ActionForm, FField, FSelect, FTextArea, SubmitButton } from "@/components/forms/action-form";
import { FileUploader } from "@/components/forms/file-uploader";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel } from "@/components/ui/page-header";
import { Alert, StatusBadge } from "@/components/ui/status";
import { Table, TableWrap, TD, TH, THead, TR } from "@/components/ui/table";
import { can } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { isAppError } from "@/lib/errors";
import { formatMoney } from "@/lib/money";
import { FLOW, ISSUE_LABEL, ISSUE_TYPES, PRIORITIES, PRIORITY_LABEL, PRIORITY_TONE, STAGE_LABEL, STAGE_TONE, flowIndex, type JobStage } from "@/lib/production";
import { getBusinessSettings } from "@/lib/settings";
import { formatDate, formatDateTime, todayLocal } from "@/lib/time";
import { listLocations } from "@/server/inventory";
import { getJob, getJobCosting, listWorkers } from "@/server/production";
import { listStockItemOptions } from "@/server/purchasing";
import {
  addIssueAction,
  attachFilesAction,
  changeStageAction,
  recordConsumptionAction,
  recordLabourAction,
  planMaterialAction,
  removePlanAction,
  resolveIssueAction,
  setAssigneesAction,
  updateJobDetailsAction,
} from "../actions";

export const metadata = { title: "Production job" };

const num = (v: string) => Number(v);

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor();
  let d;
  try {
    d = await getJob(actor, id);
  } catch (e) {
    if (isAppError(e) && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  const business = await getBusinessSettings();
  const tz = business.timezone;
  const { job } = d;
  const manager = can(actor, "production:write");
  const costs = d.canSeeCosts;
  const stage = job.stage as JobStage;
  const closed = stage === "cancelled";
  const overdue = Boolean(job.targetDate && job.targetDate < todayLocal(tz) && stage !== "ready_for_delivery" && !closed);
  const idx = flowIndex(stage);
  const next = idx >= 0 && idx < FLOW.length - 1 ? FLOW[idx + 1]! : null;
  const canUpdate = can(actor, "production:update_stage") && !closed;
  const canRecord = can(actor, "production:record_materials") && !closed;
  const [materials, locs, workers, costing] = await Promise.all([
    canRecord || manager ? listStockItemOptions(actor, { materialsOnly: true }) : Promise.resolve([]),
    canRecord ? listLocations(actor) : Promise.resolve([]),
    manager ? listWorkers(actor) : Promise.resolve([]),
    costs ? getJobCosting(actor, id) : Promise.resolve(null),
  ]);
  const spec = (job.specification ?? []) as Array<{ description: string; quantity: string; specification: Record<string, string> | null }>;
  const openIssues = d.issues.filter((i) => !i.resolvedAt);

  return (
    <>
      <PageHeader
        title={`${job.reference} · ${job.description}`}
        description={`${d.customerName ? `For ${d.customerName}. ` : ""}Order ${d.order.reference}.`}
        actions={can(actor, "orders:view") ? <Link className="inline-flex min-h-10 items-center underline" href={`/app/orders/${d.order.id}`}>Open order</Link> : undefined}
      />
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <StatusBadge tone={STAGE_TONE[stage]}>{STAGE_LABEL[stage]}</StatusBadge>
        {job.priority !== "normal" ? <StatusBadge tone={PRIORITY_TONE[job.priority]}>{PRIORITY_LABEL[job.priority]} priority</StatusBadge> : null}
        {overdue ? <StatusBadge tone="danger">Overdue</StatusBadge> : null}
        {job.targetDate ? <span className="text-sm text-text-muted">Due {formatDate(job.targetDate, tz)}</span> : <span className="text-sm text-text-muted">No due date</span>}
        <span className="text-sm text-text-muted">{d.assignees.length ? `Assigned to ${d.assignees.map((a) => a.name).join(", ")}` : "Not assigned"}</span>
      </div>

      {closed ? <Alert tone="danger" title="This job was cancelled with its order" className="mb-6">Materials already used stay on record. No further changes can be made.</Alert> : null}
      {openIssues.length > 0 ? <Alert tone="warning" title={`${openIssues.length} open ${openIssues.length === 1 ? "issue" : "issues"}`} className="mb-6">Resolve them below once they are dealt with.</Alert> : null}

      <div className="grid items-start gap-6 xl:grid-cols-3">
        <div className="min-w-0 space-y-6 xl:col-span-2">
          {canUpdate ? (
            <Panel title="Update stage" description="Large buttons for use on the workshop floor. Going back (rework) or putting a job on hold needs a short note.">
              {next ? (
                <ActionForm action={changeStageAction} className="mb-6">
                  <input type="hidden" name="jobId" value={job.id} />
                  <input type="hidden" name="to" value={next} />
                  <SubmitButton size="lg" pendingLabel="Updating…">Move to “{STAGE_LABEL[next]}”</SubmitButton>
                </ActionForm>
              ) : null}
              {stage === "on_hold" ? <p className="mb-4 text-sm text-text-muted">This job is on hold. Choose where it resumes below.</p> : null}
              <ActionForm action={changeStageAction} className="border-t border-border pt-5">
                <input type="hidden" name="jobId" value={job.id} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <FSelect name="to" label="Move to" required placeholder="Choose a stage" options={[...FLOW, "on_hold" as const].filter((s) => s !== stage).map((s) => ({ value: s, label: STAGE_LABEL[s] }))} />
                  <FField name="note" label="Note" hint="Required for rework and for putting on hold." />
                </div>
                <SubmitButton variant="secondary">Change stage</SubmitButton>
              </ActionForm>
            </Panel>
          ) : null}

          <Panel title="What to make">
            {spec.length === 0 ? <p className="text-sm text-text-muted">No specification was recorded.</p> : (
              <ul className="space-y-4">
                {spec.map((s, i) => (
                  <li key={i}>
                    <p className="font-medium">{s.description} <span className="font-normal text-text-muted">× {Number(s.quantity)}</span></p>
                    {s.specification && Object.keys(s.specification).length ? (
                      <dl className="mt-1 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                        {s.specification.dimensions ? <div><dt className="inline text-text-muted">Dimensions: </dt><dd className="inline">{s.specification.dimensions}</dd></div> : null}
                        {s.specification.material ? <div><dt className="inline text-text-muted">Wood / material: </dt><dd className="inline">{s.specification.material}</dd></div> : null}
                        {s.specification.finish ? <div><dt className="inline text-text-muted">Finish: </dt><dd className="inline">{s.specification.finish}</dd></div> : null}
                        {s.specification.notes ? <div className="sm:col-span-2"><dt className="inline text-text-muted">Notes: </dt><dd className="inline whitespace-pre-line">{s.specification.notes}</dd></div> : null}
                      </dl>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            <h3 className="mt-6 text-sm font-semibold">Reference images and drawings</h3>
            {d.files.length === 0 ? <p className="mt-1 text-sm text-text-muted">None attached.</p> : (
              <ul className="mt-2 divide-y divide-border text-sm">
                {d.files.map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0 truncate">{f.name}</span>
                    <a className="shrink-0 underline" href={`/api/files/${f.id}`} target="_blank" rel="noopener noreferrer">Open<span className="sr-only"> {f.name} (opens in a new tab)</span></a>
                  </li>
                ))}
              </ul>
            )}
            {manager && !closed ? (
              <ActionForm action={attachFilesAction} className="mt-4 border-t border-border pt-4">
                <input type="hidden" name="jobId" value={job.id} />
                <FileUploader purpose="job_reference" label="Add reference files" accept="image/jpeg,image/png,image/webp,application/pdf" />
                <SubmitButton variant="secondary">Attach files</SubmitButton>
              </ActionForm>
            ) : null}
          </Panel>

          <Panel title="Materials" description={costs ? "Planned materials are an estimate only. Stock is reduced only when usage is recorded." : "Stock is reduced only when you record what was used."}>
            {d.plan.length > 0 ? (
              <TableWrap label="Planned materials" className="mb-6">
                <Table>
                  <THead><tr><TH>Material</TH><TH className="text-right">Planned</TH>{costs ? <TH className="text-right">Est. cost / unit</TH> : null}{manager && !closed ? <TH><span className="sr-only">Remove</span></TH> : null}</tr></THead>
                  <tbody>
                    {d.plan.map((p) => (
                      <TR key={p.id}>
                        <TD>{p.name}{p.note ? <span className="block text-xs text-text-muted">{p.note}</span> : null}</TD>
                        <TD numeric>{num(p.planned)} {p.unit}</TD>
                        {costs ? <TD numeric>{p.unitCost ? formatMoney(p.unitCost, business.currency) : <span className="text-warning">No cost</span>}</TD> : null}
                        {manager && !closed ? (
                          <TD>
                            <ActionForm action={removePlanAction} className="space-y-0">
                              <input type="hidden" name="jobId" value={job.id} />
                              <input type="hidden" name="planId" value={p.id} />
                              <Button type="submit" variant="ghost">Remove<span className="sr-only"> {p.name}</span></Button>
                            </ActionForm>
                          </TD>
                        ) : null}
                      </TR>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            ) : <p className="mb-4 text-sm text-text-muted">No materials planned.</p>}
            {manager && !closed ? (
              <ActionForm action={planMaterialAction} className="mb-6 border-b border-border pb-6">
                <h3 className="text-sm font-semibold">Plan a material</h3>
                <input type="hidden" name="jobId" value={job.id} />
                <div className="grid gap-4 sm:grid-cols-3">
                  <FSelect name="itemId" label="Material" required placeholder="Choose a material" options={materials.map((m) => ({ value: m.id, label: `${m.name} (${m.unit})` }))} />
                  <FField name="plannedQuantity" label="Planned quantity" required inputMode="decimal" />
                  <FField name="estimatedUnitCost" label="Estimated cost per unit" inputMode="decimal" hint="Leave blank to use the stock item's cost." />
                </div>
                <SubmitButton variant="secondary">Add to plan</SubmitButton>
              </ActionForm>
            ) : null}

            <h3 className="mb-2 text-sm font-semibold">Used on this job</h3>
            {d.consumption.length === 0 ? <p className="mb-4 text-sm text-text-muted">Nothing recorded yet.</p> : (
              <TableWrap label="Materials used" className="mb-6">
                <Table>
                  <THead><tr><TH>When</TH><TH>Material</TH><TH className="text-right">Used</TH><TH className="text-right">Wasted</TH><TH className="hidden md:table-cell">By</TH></tr></THead>
                  <tbody>
                    {d.consumption.map((c) => (
                      <TR key={c.id}>
                        <TD className="whitespace-nowrap">{formatDateTime(c.at, tz)}</TD>
                        <TD>{c.name}<span className="block text-xs text-text-muted">from {c.locationName}{c.note ? ` · ${c.note}` : ""}</span></TD>
                        <TD numeric>{num(c.quantity)} {c.unit}</TD>
                        <TD numeric>{num(c.waste) ? `${num(c.waste)} ${c.unit}` : "—"}</TD>
                        <TD className="hidden md:table-cell">{c.byName ?? "—"}</TD>
                      </TR>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            )}
            {canRecord ? (
              <div className="border-t border-border pt-5">
                <h3 className="mb-3 text-sm font-semibold">Record material used</h3>
                <ConsumptionForm action={recordConsumptionAction} jobId={job.id} initialKey={randomUUID()} materials={materials.map((m) => ({ id: m.id, name: m.name, unit: m.unit }))} locations={[...locs.filter((l) => l.isActive)].sort((a, b) => Number(b.kind === "workshop") - Number(a.kind === "workshop")).map((l) => ({ id: l.id, name: l.name }))} />
              </div>
            ) : null}
          </Panel>

          <Panel title="Problems and delays" description="Report anything that slows the job or needs doing again.">
            {d.issues.length === 0 ? <p className="mb-4 text-sm text-text-muted">Nothing reported.</p> : (
              <ul className="mb-6 divide-y divide-border">
                {d.issues.map((i) => (
                  <li key={i.id} className="flex flex-col gap-2 py-3 first:pt-0 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-sm"><StatusBadge tone={i.resolvedAt ? "neutral" : "warning"}>{ISSUE_LABEL[i.type]}{i.resolvedAt ? " · resolved" : ""}</StatusBadge><span className="text-text-muted">{formatDateTime(i.createdAt, tz)} · {i.byName ?? "—"}</span></p>
                      <p className="mt-1 whitespace-pre-line text-sm">{i.note}</p>
                    </div>
                    {!i.resolvedAt && canUpdate ? (
                      <ActionForm action={resolveIssueAction} className="space-y-0">
                        <input type="hidden" name="jobId" value={job.id} />
                        <input type="hidden" name="issueId" value={i.id} />
                        <Button type="submit" variant="secondary">Mark resolved</Button>
                      </ActionForm>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            {canUpdate ? (
              <ActionForm action={addIssueAction} className="border-t border-border pt-5">
                <input type="hidden" name="jobId" value={job.id} />
                <div className="grid gap-4 sm:grid-cols-3">
                  <FSelect name="type" label="Type" required defaultValue="issue" options={ISSUE_TYPES.map((t) => ({ value: t, label: ISSUE_LABEL[t] }))} />
                  <FTextArea name="note" label="What happened?" required rows={2} className="sm:col-span-2" />
                </div>
                <SubmitButton variant="secondary">Report</SubmitButton>
              </ActionForm>
            ) : null}
          </Panel>
        </div>

        <div className="min-w-0 space-y-6">
          {manager && !closed ? (
            <Panel title="Job details">
              <ActionForm action={updateJobDetailsAction}>
                <input type="hidden" name="jobId" value={job.id} />
                <FField name="description" label="Description" required defaultValue={job.description} />
                <FSelect name="priority" label="Priority" required defaultValue={job.priority} options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))} />
                <FField name="targetDate" label="Due date" type="date" defaultValue={job.targetDate ?? ""} />
                <SubmitButton variant="secondary">Save</SubmitButton>
              </ActionForm>
            </Panel>
          ) : null}
          {manager && !closed ? (
            <Panel title="Assigned to" description="Workshop staff see only the jobs they are assigned to.">
              <ActionForm action={setAssigneesAction}>
                <input type="hidden" name="jobId" value={job.id} />
                <fieldset className="space-y-1">
                  <legend className="sr-only">People working on this job</legend>
                  {workers.map((w) => (
                    <label key={w.id} className="flex min-h-10 items-center gap-3 text-sm">
                      <input type="checkbox" name="assigneeIds" value={w.id} defaultChecked={d.assignees.some((a) => a.id === w.id)} className="size-5 accent-[var(--color-walnut)]" /> {w.name}
                    </label>
                  ))}
                </fieldset>
                <SubmitButton variant="secondary">Save assignment</SubmitButton>
              </ActionForm>
            </Panel>
          ) : null}

          {costing ? (
            <Panel title="Cost estimate" description="An estimate from the costs that were entered. It is not audited profit.">
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-3"><dt className="text-text-muted">Order total</dt><dd className="tabular">{formatMoney(costing.orderTotal, costing.currency)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-text-muted">Planned materials</dt><dd className="tabular">{formatMoney(costing.estimatedMaterials, costing.currency)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-text-muted">Materials used so far</dt><dd className="tabular">{formatMoney(costing.actualMaterials, costing.currency)}</dd></div>
                {d.trackLabour ? <div className="flex justify-between gap-3"><dt className="text-text-muted">Labour recorded</dt><dd className="tabular">{formatMoney(costing.actualLabour, costing.currency)}</dd></div> : null}
                <div className="flex justify-between gap-3 border-t border-border pt-2 font-semibold"><dt>Margin so far (estimate)</dt><dd className="tabular">{costing.actualMargin !== null ? formatMoney(costing.actualMargin, costing.currency) : costing.estimatedMargin !== null ? `${formatMoney(costing.estimatedMargin, costing.currency)} (planned)` : "—"}</dd></div>
              </dl>
              {costing.missingCosts.length > 0 ? <Alert tone="warning" title="Some costs are missing" className="mt-4">No cost is set for: {costing.missingCosts.join(", ")}. The figures above leave these out.</Alert> : null}
              {!costing.complete ? <p className="mt-3 text-xs text-text-muted">This is not final until the job is finished and every material has a cost.</p> : null}
            </Panel>
          ) : null}

          {costs && d.trackLabour ? (
            <Panel title="Labour">
              {d.labour.length === 0 ? <p className="mb-4 text-sm text-text-muted">No labour recorded.</p> : (
                <ul className="mb-4 divide-y divide-border text-sm">
                  {d.labour.map((l) => <li key={l.id} className="flex justify-between gap-3 py-2"><span>{l.description}{l.hours ? <span className="text-text-muted"> · {num(l.hours)} h</span> : null}</span><span className="tabular">{formatMoney(l.amount, business.currency)}</span></li>)}
                </ul>
              )}
              {!closed ? (
                <ActionForm action={recordLabourAction}>
                  <input type="hidden" name="jobId" value={job.id} />
                  <FField name="description" label="What was done" required />
                  <div className="grid grid-cols-2 gap-3">
                    <FField name="hours" label="Hours" inputMode="decimal" />
                    <FField name="hourlyRate" label="Hourly rate" inputMode="decimal" />
                  </div>
                  <FField name="amount" label="Or a fixed amount" inputMode="decimal" hint="Used when hours and rate are blank." />
                  <SubmitButton variant="secondary">Record labour</SubmitButton>
                </ActionForm>
              ) : null}
            </Panel>
          ) : null}

          <Panel title="History">
            <ol className="space-y-3 text-sm">
              {d.history.map((h) => (
                <li key={h.id}>
                  <p className="font-medium">{h.from ? `${STAGE_LABEL[h.from as JobStage]} → ` : ""}{STAGE_LABEL[h.to as JobStage]}</p>
                  <p className="text-text-muted">{formatDateTime(h.at, tz)} · {h.byName ?? "System"}</p>
                  {h.note ? <p className="mt-0.5 whitespace-pre-line">{h.note}</p> : null}
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>
    </>
  );
}
