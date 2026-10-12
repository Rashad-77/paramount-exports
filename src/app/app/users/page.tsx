import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { ConfirmSubmit } from "@/components/forms/confirm-submit";
import { ModuleHeader, Panel } from "@/components/ui/page-header";
import { Alert, StatusBadge } from "@/components/ui/status";
import { ROLES, requirePermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { listUsers } from "@/server/users";
import { setActiveAction, setRolesAction } from "./actions";

export const metadata = { title: "Employees" };

const ROLE_HELP: Record<string, string> = {
  owner: "Everything, including users and settings.",
  manager: "Runs the business day to day; no user or business-setting changes.",
  sales: "Enquiries, customers, quotations, orders and payments.",
  workshop: "Assigned jobs, materials, receiving goods, own deliveries.",
  finance: "Payments, expenses, supplier payments and financial reports.",
};

export default async function UsersPage() {
  const actor = await requireActor();
  requirePermission(actor, "users:manage");
  const users = await listUsers(actor);
  return (
    <>
      <ModuleHeader href="/app/users" />
      <Alert tone="info" title="Adding a new person" className="mb-6">
        New accounts are created by the owner from a trusted computer with <code>pnpm create-user</code> (see docs/OPERATIONS.md). Once the account exists, set its roles here.
      </Alert>
      <div className="min-w-0 space-y-6">
        {users.map((u) => (
          <Panel key={u.id} title={u.name} description={u.id === actor.id ? "This is you." : undefined} actions={<StatusBadge tone={u.isActive ? "success" : "neutral"}>{u.isActive ? "Active" : "Deactivated"}</StatusBadge>}>
            <ActionForm action={setRolesAction}>
              <input type="hidden" name="userId" value={u.id} />
              <fieldset className="grid gap-2 sm:grid-cols-2">
                <legend className="mb-2 text-sm font-medium">Roles</legend>
                {ROLES.map((r) => (
                  <label key={r} className="flex min-h-10 items-start gap-3 text-sm">
                    <input type="checkbox" name="roles" value={r} defaultChecked={u.roles.includes(r)} className="mt-0.5 size-5 shrink-0 accent-[var(--color-walnut)]" />
                    <span><span className="font-medium capitalize">{r}</span><span className="block text-text-muted">{ROLE_HELP[r]}</span></span>
                  </label>
                ))}
              </fieldset>
              <SubmitButton variant="secondary">Save roles</SubmitButton>
            </ActionForm>
            {u.id !== actor.id ? (
              <ActionForm action={setActiveAction} className="mt-6 border-t border-border pt-5">
                <input type="hidden" name="userId" value={u.id} />
                <input type="hidden" name="active" value={u.isActive ? "0" : "1"} />
                {u.isActive ? (
                  <ConfirmSubmit title={`Deactivate ${u.name}?`} description="They are signed out of every screen straight away and cannot use the system. Their history stays on record. You can reactivate them later." confirmLabel="Deactivate">Deactivate account</ConfirmSubmit>
                ) : (
                  <SubmitButton variant="secondary">Reactivate account</SubmitButton>
                )}
              </ActionForm>
            ) : null}
          </Panel>
        ))}
      </div>
    </>
  );
}
