import type { Metadata } from "next";
import { demoSignInAllowed } from "@/lib/auth/demo";
import { getBusinessSettings } from "@/lib/settings";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Owner sign in", robots: { index: false, follow: false } };

const NOTICES: Record<string, string> = {
  "no-access": "This sign-in is for the business owner only.",
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

/** Split screen: a dark textured brand panel beside the form. */
function AuthFrame({ name, heading, sub, children }: { name: string; heading: string; sub?: string; children: React.ReactNode }) {
  return (
    <main id="main" className="app-ui grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <div className="relative isolate hidden bg-walnut-dark overflow-hidden p-14 text-ivory lg:flex lg:flex-col lg:justify-between">
        <p className="eyebrow rise-in relative !text-linen-dark">Owner area</p>
        <div className="relative">
          <p className="font-display rise-in rise-in-2 text-[clamp(3rem,5vw,5.5rem)] leading-[1.02] tracking-[-0.02em]">{name}</p>
          <div className="rise-in rise-in-3 mt-8 h-px w-24 bg-brand" />
        </div>
        <p className="rise-in rise-in-3 relative max-w-xs text-sm leading-relaxed text-ivory/95">Enquiries, orders, workshop, stock and deliveries in one place.</p>
      </div>
      <div className="flex items-center justify-center px-[var(--gutter)] py-14">
        <div className="rise-in w-full max-w-sm">
          <p className="font-display text-2xl text-walnut lg:hidden">{name}</p>
          <h1 className={"font-display mt-6 text-[2.25rem] leading-tight text-walnut lg:mt-0" + (sub ? "" : " mb-8")}>{heading}</h1>
          {sub ? <p className="mt-2 mb-8 text-sm text-text-muted">{sub}</p> : null}
          {children}
        </div>
      </div>
    </main>
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
