import { ActionForm, FField, FSelect, FTextArea, SubmitButton } from "@/components/forms/action-form";
import { SavedReviews } from "@/components/app/saved-reviews";
import { ModuleHeader, Panel } from "@/components/ui/page-header";
import { requireActor } from "@/lib/auth/session";
import { formatReviewDate } from "@/lib/google-reviews";
import { listGoogleReviewsAdmin } from "@/server/google-review-store";
import { addReviewAction, deleteReviewsAction, setReviewsHiddenAction } from "./actions";

export const metadata = { title: "Reviews" };

const STARS = [5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: `${n} ${n === 1 ? "star" : "stars"}` }));

export default async function ReviewsAdminPage() {
  const actor = await requireActor();
  const reviews = await listGoogleReviewsAdmin(actor);
  return (
    <>
      <ModuleHeader href="/app/reviews" />
      <div className="min-w-0 space-y-6">
        <Panel title="Add a review" description="Copy a review from Google. It shows on the homepage straight away, without a picture. A review that is already saved is refused.">
          <ActionForm action={addReviewAction}>
            <div className="grid gap-4 sm:grid-cols-3">
              <FField name="author" kind="title" label="Reviewer's name" required />
              <FSelect name="rating" label="Stars" options={STARS} defaultValue="5" required />
              <FField name="postedOn" type="date" label="Date posted" max={new Date().toISOString().slice(0, 10)} required />
            </div>
            <FTextArea name="body" label="Review (optional)" rows={4} />
            <SubmitButton pendingLabel="Adding…">Add review</SubmitButton>
          </ActionForm>
        </Panel>
        <Panel title="Saved reviews" description="Newest first. Press Edit, tick the reviews, then hide them to take them off the website without losing them, or delete them for good.">
          <SavedReviews
            reviews={reviews.map((r) => ({ id: r.id, author: r.author, rating: r.rating, body: r.body, hidden: r.hidden, dateIso: (r.publishedAt ?? r.createdAt).toISOString(), dateText: formatReviewDate((r.publishedAt ?? r.createdAt).toISOString()) ?? "" }))}
            hideAction={setReviewsHiddenAction}
            deleteAction={deleteReviewsAction}
          />
        </Panel>
      </div>
    </>
  );
}
