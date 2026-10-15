import "server-only";
import { notFound } from "next/navigation";
import { customerAuthMode } from "@/lib/auth/customer";
import { getAccountSettings, type AccountSettings } from "@/lib/settings";

/** Account pages exist only while the owner has accounts on AND a sign-in service is connected. Otherwise they are simply not there. */
export async function requireAccountsOn(): Promise<AccountSettings> {
  const settings = await getAccountSettings();
  if (!settings.enabled || customerAuthMode() === "off") notFound();
  return settings;
}
