import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getBusinessSettings } from "@/lib/settings";
import { ownerFromSession } from "@/server/owner-auth";
import { AuthFrame } from "../../auth-frame";
import { ResetForm } from "../owner-forms";

export const metadata: Metadata = { title: "New password", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ResetPage() {
  // Only reached from the emailed link, which signs the owner in for this one step.
  if (!(await ownerFromSession())) redirect("/login?error=link-expired");
  const business = await getBusinessSettings();
  return (
    <AuthFrame name={business.name} heading="Choose a new password" sub="Use at least 12 characters. You will sign in again with it.">
      <ResetForm />
    </AuthFrame>
  );
}
