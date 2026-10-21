import type { Metadata } from "next";
import { SettingRow } from "@/components/app/setting-row";
import { ActionForm, FField, SubmitButton } from "@/components/forms/action-form";
import { PageHeader, Panel } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/status";
import { Table, TableWrap } from "@/components/ui/table";
import { requireActor } from "@/lib/auth/session";
import { PASSWORD_MAX, PASSWORD_MIN } from "@/lib/schemas/accounts";
import { mfaState } from "@/server/owner-auth";
import { signInDetailsAvailable, staffSignInEmail } from "@/server/staff-account";
import { MfaPanel } from "./mfa-panel";
import { changeEmailAction, changePasswordAction, updateNameAction } from "./actions";

export const metadata: Metadata = { title: "Your account" };

const ROLE_LABEL: Record<string, string> = { owner: "Owner", manager: "Manager", sales: "Sales", workshop: "Workshop", finance: "Finance" };

export default async function AccountPage() {
  const actor = await requireActor();
  const email = await staffSignInEmail();
  const roles = actor.roles.map((r) => ROLE_LABEL[r] ?? r).join(", ");
  const canChangeSignIn = signInDetailsAvailable();
  const mfa = canChangeSignIn ? await mfaState() : null;

  return (
    <>
      <PageHeader title="Your account" description="Your name, and the email and password you sign in with." />
      <div className="min-w-0 space-y-6">
        <Panel title="Your details">
          <ActionForm action={updateNameAction}>
            <TableWrap label="Your details">
              <Table className="table-fixed">
                <tbody>
                  <SettingRow label="Name" required>
                    <FField name="fullName" kind="personName" label="Name" defaultValue={actor.fullName} maxLength={120} required />
                  </SettingRow>
                  <SettingRow label="Role" plain>
                    <span className="text-sm font-medium">{roles}</span>
                  </SettingRow>
                </tbody>
              </Table>
            </TableWrap>
            <SubmitButton>Save name</SubmitButton>
          </ActionForm>
        </Panel>

        {canChangeSignIn ? (
          <>
            <Panel title="Sign-in email" description="The address you use to sign in. A new address takes effect once you open the confirmation link sent to it.">
              <ActionForm action={changeEmailAction}>
                <TableWrap label="Sign-in email">
                  <Table className="table-fixed">
                    <tbody>
                      <SettingRow label="Current email" plain>
                        <span className="text-sm font-medium">{email ?? "Not available"}</span>
                      </SettingRow>
                      <SettingRow label="New email" required>
                        <FField name="email" kind="email" label="New email" type="email" autoComplete="email" maxLength={200} required />
                      </SettingRow>
                    </tbody>
                  </Table>
                </TableWrap>
                <SubmitButton>Change email</SubmitButton>
              </ActionForm>
            </Panel>

            <Panel title="Password" description={`Use at least ${PASSWORD_MIN} characters.`}>
              <ActionForm action={changePasswordAction}>
                <TableWrap label="Password">
                  <Table className="table-fixed">
                    <tbody>
                      <SettingRow label="Current password" required>
                        <FField name="currentPassword" label="Current password" type="password" autoComplete="current-password" maxLength={200} required />
                      </SettingRow>
                      <SettingRow label="New password" required>
                        <FField name="newPassword" label="New password" type="password" autoComplete="new-password" maxLength={PASSWORD_MAX} required />
                      </SettingRow>
                      <SettingRow label="Retype new password" required>
                        <FField name="confirmPassword" label="Retype new password" type="password" autoComplete="new-password" maxLength={PASSWORD_MAX} required />
                      </SettingRow>
                    </tbody>
                  </Table>
                </TableWrap>
                <SubmitButton>Change password</SubmitButton>
              </ActionForm>
            </Panel>

            <Panel title="Two-step sign-in" description="A code from an authenticator app on your phone, asked for after the password.">
              <MfaPanel enabled={mfa?.enabled ?? false} />
            </Panel>
          </>
        ) : (
          <Alert tone="info" title="Sign-in details">
            The email and password can be changed once the site is signed in through its sign-in service. This copy has no password to change.
          </Alert>
        )}
      </div>
    </>
  );
}
