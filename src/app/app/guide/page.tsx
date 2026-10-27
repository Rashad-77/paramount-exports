import { OwnerGuide } from "@/components/app/owner-guide";
import { ModuleHeader } from "@/components/ui/page-header";
import { requireActor } from "@/lib/auth/session";

export const metadata = { title: "Guide" };

/** The owner's guide to the dashboard: a question box and the whole guide as questions that open to the detailed steps. */
export default async function GuidePage() {
  await requireActor();
  return (
    // The title sits in the same centred column as the question box and the guide, so its left edge lines up with theirs.
    <div className="mx-auto max-w-3xl">
      <ModuleHeader href="/app/guide" />
      <OwnerGuide />
    </div>
  );
}
