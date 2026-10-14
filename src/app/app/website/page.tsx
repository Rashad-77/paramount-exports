import { ActionForm, FTextArea, SubmitButton } from "@/components/forms/action-form";
import { ModuleHeader, Panel } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { DEFAULT_HISTORY_INTRO } from "@/lib/history";
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
          <FTextArea
            name="testimonials"
            label="Customer reviews (homepage)"
            rows={10}
            defaultValue={pages.testimonials ?? ""}
            placeholder={'"The table is exactly what we asked for."\n— Name, Town\n\n"Another review."\n— Name, Town'}
            hint="Only add reviews that customers have really given you. One review per block, separated by a blank line; put the quote first and, on the last line, a dash then the name and town. Leave blank to show no reviews."
          />
          <FTextArea name="historyIntro" label="Our history: short description (About page)" rows={3} defaultValue={pages.historyIntro ?? ""} placeholder={DEFAULT_HISTORY_INTRO} hint="A sentence or two under the heading. Leave blank to show the standard line." />
          <FTextArea
            name="history"
            label="Our history (About page)"
            rows={10}
            defaultValue={pages.history ?? ""}
            placeholder={"2009\nThe first bench\nWe started with one bench and two hand tools.\n\n2015\nOpening the showroom\nThe story of that year."}
            hint="One milestone per block, separated by a blank line. First line the year, second line the heading, then the story. Only add what really happened. Leave blank to show a labelled outline."
          />
          <SubmitButton>Save page content</SubmitButton>
        </ActionForm>
      </Panel>
    </>
  );
}
