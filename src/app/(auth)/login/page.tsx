import type { Metadata } from "next";
import { getBusinessSettings } from "@/lib/settings";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Staff sign in", robots: { index: false, follow: false } };

const NOTICES: Record<string, string> = {
  "no-access": "Your account does not have access to the staff area. Please contact the business owner.",
  "not-configured": "Sign-in has not been configured yet. Ask the system administrator to finish setup.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const [{ next, error }, business] = await Promise.all([searchParams, getBusinessSettings()]);
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
