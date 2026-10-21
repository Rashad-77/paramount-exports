import {
  ActionForm,
  FField,
  FTextArea,
  SubmitButton,
} from "@/components/forms/action-form";
import { ModuleHeader, Panel } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { SAMPLE_OWNER } from "@/lib/history";
import {
  DEFAULT_ABOUT,
  DEFAULT_PRIVACY,
  DEFAULT_TERMS,
} from "@/lib/default-pages";
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
      <Panel
        title="Page content"
        description="Plain text. Separate paragraphs with a blank line; start a line with ## for a heading and with - for a bullet. Leave blank to show the draft text."
      >
        <ActionForm action={updatePagesAction}>
          <FTextArea
            name="about"
            label="About us: who we are (About page)"
            rows={8}
            defaultValue={pages.about ?? ""}
            placeholder={DEFAULT_ABOUT}
          />
          <FTextArea
            name="privacy"
            label="Privacy notice"
            rows={12}
            defaultValue={pages.privacy ?? ""}
            placeholder={DEFAULT_PRIVACY.slice(0, 200) + "…"}
            hint="The draft text describes what this website really collects. Have your final notice reviewed before launch."
          />
          <FTextArea
            name="terms"
            label="Terms"
            rows={8}
            defaultValue={pages.terms ?? ""}
            placeholder={DEFAULT_TERMS.slice(0, 200) + "…"}
          />
          <div className="grid gap-5 md:grid-cols-2">
            <FField
              name="ownerName" kind="personName"
              label="Owner: name (About page)"
              maxLength={120}
              defaultValue={pages.ownerName ?? ""}
              placeholder={SAMPLE_OWNER.name}
            />
            <FField
              name="ownerRole" kind="title"
              label="Owner: role"
              maxLength={120}
              defaultValue={pages.ownerRole ?? ""}
              placeholder="Optional, e.g. Owner"
            />
          </div>
          <FTextArea
            name="ownerBio"
            label="Owner: a little description"
            rows={5}
            maxLength={1500}
            defaultValue={pages.ownerBio ?? ""}
            placeholder={SAMPLE_OWNER.bio}
            hint="Plain text, a few sentences. Separate paragraphs with a blank line. Leave all three blank to show a labelled outline."
          />
          <SubmitButton>Save page content</SubmitButton>
        </ActionForm>
      </Panel>
    </>
  );
}
