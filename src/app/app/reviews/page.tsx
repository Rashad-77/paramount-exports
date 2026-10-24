import { ActionForm, FField, FSelect, FTextArea, SubmitButton } from "@/components/forms/action-form";
import { ConfirmSubmit } from "@/components/forms/confirm-submit";
import { ModuleHeader, Panel } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status";
import { EmptyRow, Table, TableWrap, TD, TH, THead, TR } from "@/components/ui/table";
import { requireActor } from "@/lib/auth/session";
import { formatReviewDate } from "@/lib/google-reviews";
import { listGoogleReviewsAdmin } from "@/server/google-review-store";
import { addReviewAction, deleteReviewAction, setReviewHiddenAction } from "./actions";

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
            <FTextArea name="body" label="Review" rows={4} required />
            <SubmitButton pendingLabel="Adding…">Add review</SubmitButton>
          </ActionForm>
        </Panel>
        <Panel title="Saved reviews" description="Newest first. Hide a review to take it off the website without losing it, or delete it for good.">
          <TableWrap label="Saved Google reviews">
            <Table>
              <THead>
                <TR>
                  <TH>Reviewer</TH>
                  <TH>Review</TH>
                  <TH>Date</TH>
                  <TH>Status</TH>
                  <TH>
                    <span className="sr-only">Actions</span>
                  </TH>
                </TR>
              </THead>
              <tbody>
                {reviews.length === 0 ? (
                  <EmptyRow colSpan={5} title="No reviews saved yet" description="Add one above." />
                ) : (
                  reviews.map((r) => (
                    <TR key={r.id}>
                      <TD>
                        <span className="font-medium">{r.author}</span>
                        <span className="block text-xs text-text-muted">{"★".repeat(r.rating)}</span>
                      </TD>
                      <TD className="max-w-md">
                        <p className="line-clamp-3">{r.body}</p>
                      </TD>
                      <TD>{formatReviewDate((r.publishedAt ?? r.createdAt).toISOString()) ?? ""}</TD>
                      <TD>
                        <div className="flex flex-wrap gap-1.5">
                          <StatusBadge tone={r.hidden ? "warning" : "success"}>{r.hidden ? "Hidden" : "Shown"}</StatusBadge>
                        </div>
                      </TD>
                      <TD>
                        <div className="flex flex-wrap justify-end gap-2">
                          <ActionForm action={setReviewHiddenAction} className="space-y-0">
                            <input type="hidden" name="id" value={r.id} />
                            <input type="hidden" name="hidden" value={r.hidden ? "false" : "true"} />
                            <SubmitButton variant="ghost">
                              {r.hidden ? "Show" : "Hide"}
                            </SubmitButton>
                          </ActionForm>
                          <ActionForm action={deleteReviewAction} className="space-y-0">
                              <input type="hidden" name="id" value={r.id} />
                              <ConfirmSubmit variant="ghost" title="Delete this review?" description="It is removed from the website and from the saved reviews." confirmLabel="Delete">
                                Delete
                              </ConfirmSubmit>
                            </ActionForm>
                        </div>
                      </TD>
                    </TR>
                  ))
                )}
              </tbody>
            </Table>
          </TableWrap>
        </Panel>
      </div>
    </>
  );
}
