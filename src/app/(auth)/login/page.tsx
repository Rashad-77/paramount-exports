import type { Metadata } from "next";
import { demoSignInAllowed } from "@/lib/auth/demo";
import { getBusinessSettings } from "@/lib/settings";
import { AuthFrame } from "../auth-frame";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Owner sign in", robots: { index: false, follow: false } };

const NOTICES: Record<string, string> = {
  "no-access": "This sign-in is for the business owner only.",
  "link-expired": "That link has expired or was already used. Ask for a new one.",
  "password-changed": "Your password is changed. Please sign in with the new one.",
  expired: "You were signed out for your security after a period without use. Please sign in again.",
  "not-configured": "Sign-in has not been configured yet. Ask the system administrator to finish setup.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const [{ next, error }, business, demo] = await Promise.all([searchParams, getBusinessSettings(), demoSignInAllowed()]);
  if (demo) return <DemoSignIn name={business.name} />;
  return (
    <AuthFrame name={business.name} heading="Owner sign in">
      <LoginForm next={next} notice={error ? NOTICES[error] : undefined} />
    </AuthFrame>
  );
}

/** Public demo only (see lib/auth/demo-deployment.ts): sign in as the sample owner, no password. */
function DemoSignIn({ name }: { name: string }) {
  return (
    <AuthFrame name={name} heading="Demo sign in" sub="A demonstration with sample data only. There is no password: anyone with this link can open it. Do not enter real customer or business information.">
      <a href="/demo/start?role=owner" className="card-lift flex min-h-14 flex-col justify-center border border-border-strong bg-surface px-4 py-2.5">
        <span className="font-medium">Continue as Owner</span>
        <span className="text-sm text-text-muted">Everything, including users and settings</span>
      </a>
    </AuthFrame>
  );
}
