import { ActionForm, FTextArea, SubmitButton } from "@/components/forms/action-form";
import { ModuleHeader, Panel } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { DEFAULT_ABOUT, DEFAULT_PRIVACY, DEFAULT_TERMS } from "@/lib/default-pages";
import { getSettingsForAdmin } from "@/server/settings";
import { updatePagesAction } from "../settings/actions";

export const metadata = { title: "Website" };

export default async function WebsitePage() {
  const actor = await requireActor();
  requirePermission(actor, "website:manage");
  const { pages } = await getSettingsForAdmin(actor);

  return (
    <>
      <ModuleHeader href="/app/website" />
      <Panel title="Page content" description="Plain text. Separate paragraphs with a blank line; start a line with ## for a heading and with - for a bullet. Leave blank to show the draft text.">
        <ActionForm action={updatePagesAction}>
          <FTextArea name="about" label="About and craftsmanship" rows={8} defaultValue={pages.about ?? ""} placeholder={DEFAULT_ABOUT} />
          <FTextArea name="privacy" label="Privacy notice" rows={12} defaultValue={pages.privacy ?? ""} placeholder={DEFAULT_PRIVACY.slice(0, 200) + "…"} hint="The draft text describes what this website really collects. Have your final notice reviewed before launch." />
          <FTextArea name="terms" label="Terms" rows={8} defaultValue={pages.terms ?? ""} placeholder={DEFAULT_TERMS.slice(0, 200) + "…"} />
          <SubmitButton>Save page content</SubmitButton>
        </ActionForm>
      </Panel>
    </>
  );
}
