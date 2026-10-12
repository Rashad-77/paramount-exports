import { notFound } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { DashboardView } from "@/components/app/dashboard-view";
import { Alert } from "@/components/ui/status";
import type { Actor, Role } from "@/lib/auth/permissions";
import { isRole } from "@/lib/auth/permissions";
import { demoModeEnabled } from "@/lib/env";

/**
 * Development-only visual preview of the internal dashboard with SAMPLE data and a SAMPLE user, so the screen can be
 * reviewed in a browser without a Supabase project. Returns 404 unless DEMO_MODE=true AND NODE_ENV !== "production".
 * It reads no real data and grants no access to any real route or service.
 */
export const dynamic = "force-dynamic";

export default async function PreviewPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  if (!demoModeEnabled()) notFound();
  const { role } = await searchParams;
  const roles: Role[] = role && isRole(role) ? [role] : ["owner"];
  const actor: Actor = { id: "sample", fullName: "Sample Person", roles, isActive: true };

  return (
    <AppShell actor={actor} businessName="[Business Name]" currentPath="/app">
      <Alert tone="info" title="Sample preview">
        Sample user and sample data for design review only. Not connected to any real records.
      </Alert>
      <div className="h-6" />
      <DashboardView
        actor={actor}
        setup={[
          { label: "Business name", done: false, hint: "Shown in the website header, quotations and documents." },
          { label: "Showroom address and opening hours", done: false, hint: "Shown on the website. The map link appears only once an address exists." },
          { label: "Telephone or WhatsApp number", done: true, hint: "Used for the contact buttons on the website." },
          { label: "Currency and timezone confirmed", done: false, hint: "Currently assumed: LKR, Asia/Colombo. Confirm with the owner." },
        ]}
        locations={[
          { id: "1", name: "Showroom", kind: "showroom", isActive: true },
          { id: "2", name: "Workshop", kind: "workshop", isActive: true },
        ]}
      />
    </AppShell>
  );
}
