import { OwnerGuide } from "@/components/app/owner-guide";
import { ModuleHeader } from "@/components/ui/page-header";
import { requireActor } from "@/lib/auth/session";

export const metadata = { title: "Guide" };

/** The owner's guide to the dashboard: a question box and the whole guide as questions that open to the detailed steps. */
export default async function GuidePage() {
  await requireActor();
  return (
    <>
      <ModuleHeader href="/app/guide" />
      <div className="mx-auto max-w-3xl">
        <OwnerGuide />
      </div>
    </>
  );
}
