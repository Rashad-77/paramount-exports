import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getBusinessSettings } from "@/lib/settings";
import { ownerFromSession, secondStepPending } from "@/server/owner-auth";
import { AuthFrame } from "../../auth-frame";
import { VerifyForm } from "../owner-forms";

export const metadata: Metadata = { title: "Enter your code", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (!(await ownerFromSession())) redirect("/login");
  if (!(await secondStepPending())) redirect(next && /^\/app(\/[A-Za-z0-9\-_/]*)?$/.test(next) ? next : "/app");
  const business = await getBusinessSettings();
  return (
    <AuthFrame name={business.name} heading="Enter your code" sub="Open your authenticator app and type the 6-digit code shown for this site.">
      <VerifyForm next={next} />
    </AuthFrame>
  );
}
