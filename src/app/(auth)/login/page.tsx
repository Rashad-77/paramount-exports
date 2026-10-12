import type { Metadata } from "next";
import { demoSignInAllowed } from "@/lib/auth/demo";
import { ROLES } from "@/lib/auth/permissions";
import { getBusinessSettings } from "@/lib/settings";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Staff sign in", robots: { index: false, follow: false } };

const NOTICES: Record<string, string> = {
  "no-access": "Your account does not have access to the staff area. Please contact the business owner.",
  "not-configured": "Sign-in has not been configured yet. Ask the system administrator to finish setup.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const [{ next, error }, business, demo] = await Promise.all([searchParams, getBusinessSettings(), demoSignInAllowed()]);
  if (demo) return <DemoSignIn name={business.name} />;
  return (
    <main id="main" className="flex min-h-dvh items-center justify-center px-[var(--gutter)] py-12">
      <div className="w-full max-w-sm">
        <p className="font-display text-2xl text-walnut">{business.name}</p>
        <h1 className="mt-6 text-xl font-semibold">Staff sign in</h1>
        <p className="mt-1 mb-6 text-sm text-text-muted">For employees only. Accounts are created by the business owner.</p>
        <LoginForm next={next} notice={error ? NOTICES[error] : undefined} />
      </div>
    </main>
  );
}

const ROLE_BLURB: Record<string, string> = {
  owner: "Everything, including users and settings",
  manager: "Runs the business day to day",
  sales: "Enquiries, customers, quotations, orders",
  workshop: "Assigned jobs, materials, deliveries",
  finance: "Payments, expenses, reports",
};

/** Public demo only (see lib/auth/demo-deployment.ts): pick a sample role, no password. */
function DemoSignIn({ name }: { name: string }) {
  return (
    <main id="main" className="flex min-h-dvh items-center justify-center px-[var(--gutter)] py-12">
      <div className="w-full max-w-md">
        <p className="font-display text-2xl text-walnut">{name}</p>
        <h1 className="mt-6 text-xl font-semibold">Demo: choose a role to look around</h1>
        <p className="mt-1 mb-6 text-sm text-text-muted">This is a demonstration with <strong>sample data only</strong>. There is no password: anyone with this link can open it. Do not enter real customer or business information.</p>
        <ul className="space-y-3">
          {ROLES.map((r) => (
            <li key={r}>
              <a href={`/demo/start?role=${r}`} className="flex min-h-14 flex-col justify-center rounded-[var(--radius-md)] border border-border-strong bg-surface px-4 py-2 hover:bg-linen">
                <span className="font-medium capitalize">Continue as {r}</span>
                <span className="text-sm text-text-muted">{ROLE_BLURB[r]}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
