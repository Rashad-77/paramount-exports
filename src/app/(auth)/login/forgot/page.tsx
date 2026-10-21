import type { Metadata } from "next";
import { getBusinessSettings } from "@/lib/settings";
import { AuthFrame } from "../../auth-frame";
import { ForgotForm } from "../owner-forms";

export const metadata: Metadata = { title: "Forgot password", robots: { index: false, follow: false } };

export default async function ForgotPage() {
  const business = await getBusinessSettings();
  return (
    <AuthFrame name={business.name} heading="Forgot your password?" sub="Enter the owner's email address. We will send a link to choose a new password.">
      <ForgotForm />
    </AuthFrame>
  );
}
