import { asc } from "drizzle-orm";
import { DashboardView, type SetupCheck } from "@/components/app/dashboard-view";
import { getDb } from "@/lib/db/client";
import { locations } from "@/lib/db/schema";
import { requireActor } from "@/lib/auth/session";
import { getBusinessSettings, isPlaceholderBusiness } from "@/lib/settings";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const actor = await requireActor();
  const [business, rows] = await Promise.all([
    getBusinessSettings(),
    getDb().select().from(locations).orderBy(asc(locations.name)),
  ]);

  const setup: SetupCheck[] = [
    { label: "Business name", done: !isPlaceholderBusiness(business), hint: "Shown in the website header, quotations and documents." },
    { label: "Showroom address and opening hours", done: Boolean(business.address && business.openingHours), hint: "Shown on the website. The map link appears only once an address exists." },
    { label: "Telephone or WhatsApp number", done: Boolean(business.phone || business.whatsapp), hint: "Used for the contact buttons on the website." },
    { label: "Currency and timezone confirmed", done: false, hint: `Currently assumed: ${business.currency}, ${business.timezone}. Confirm with the owner.` },
  ];

  return <DashboardView actor={actor} setup={setup} locations={rows.map((r) => ({ id: r.id, name: r.name, kind: r.kind, isActive: r.isActive }))} />;
}
