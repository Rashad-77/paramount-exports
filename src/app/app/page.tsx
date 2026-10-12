import { asc } from "drizzle-orm";
import { DashboardView, type SetupCheck } from "@/components/app/dashboard-view";
import { SalesMetrics } from "@/components/app/sales-metrics";
import { can, scopeOf } from "@/lib/auth/permissions";
import { addDaysLocal, todayLocal } from "@/lib/time";
import { one, type SP } from "@/lib/list-params";
import { getSalesDashboard } from "@/server/crm-dashboard";
import { LowStockPanel } from "@/components/app/low-stock-panel";
import { lowStockAlerts } from "@/server/inventory";
import { WorkshopPanel } from "@/components/app/workshop-panel";
import { getWorkshopSummary } from "@/server/production";
import { getDb } from "@/lib/db/client";
import { locations } from "@/lib/db/schema";
import { requireActor } from "@/lib/auth/session";
import { getBusinessSettings, isPlaceholderBusiness } from "@/lib/settings";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await requireActor();
  const sp = await searchParams;
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

  let metrics: React.ReactNode = null;
  if (can(actor, "dashboard:sales")) {
    const isDate = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
    const to = isDate(one(sp.to)) ?? todayLocal(business.timezone);
    const from = isDate(one(sp.from)) ?? addDaysLocal(-29, business.timezone);
    const d = await getSalesDashboard(actor, from <= to ? { from, to } : { from: to, to: from });
    metrics = <SalesMetrics d={d} currency={business.currency} timezone={business.timezone} />;
  }

  if (can(actor, "inventory:view") || can(actor, "inventory:view_materials")) {
    const alerts = await lowStockAlerts(actor);
    metrics = (
      <>
        {metrics}
        <LowStockPanel rows={alerts.map((a) => ({ id: a.id, name: a.name, location: a.location, available: a.available, threshold: a.threshold, unit: a.unit }))} />
      </>
    );
  }

  if (can(actor, "production:view")) {
    const w = await getWorkshopSummary(actor);
    metrics = (
      <>
        {metrics}
        <WorkshopPanel byStage={w.byStage} overdue={w.overdue} active={w.active} own={scopeOf(actor, "production:view") === "own"} />
      </>
    );
  }

  return <DashboardView actor={actor} setup={setup} locations={rows.map((r) => ({ id: r.id, name: r.name, kind: r.kind, isActive: r.isActive }))} metrics={metrics} />;
}
