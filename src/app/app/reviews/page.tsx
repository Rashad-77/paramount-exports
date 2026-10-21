import { Star } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { ModuleHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { ReviewAvatar } from "@/components/public/review-avatar";
import { SiteImage } from "@/components/public/site-image";
import { requireActor } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { listReviewsForStaff } from "@/server/reviews";
import { deleteReviewAction, reviewStatusAction } from "./actions";

export const metadata = { title: "Reviews" };

const STATUS_LABEL = {
  approved: "Showing on the website",
  hidden: "Hidden",
} as const;

function Act({
  id,
  status,
  children,
}: {
  id: string;
  status: "approved" | "hidden";
  children: string;
}) {
  return (
    <ActionForm action={reviewStatusAction} className="inline-block">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <SubmitButton
        variant={status === "approved" ? "primary" : "secondary"}
        pendingLabel="Saving…"
      >
        {children}
      </SubmitButton>
    </ActionForm>
  );
}

export default async function ReviewsPage() {
  const actor = await requireActor();
  requirePermission(actor, "website:manage");
  const reviews = await listReviewsForStaff(actor);

  return (
    <>
      <ModuleHeader href="/app/reviews" />
      {reviews.length === 0 ? (
        <EmptyState
          title="No reviews yet"
          description="Reviews written in the Review pop-up on the website appear here, and show on the homepage straight away. You can hide or delete any of them."
        />
      ) : (
        <ul className="space-y-4">
          {reviews.map((r) => (
            <li key={r.id} className="border border-border bg-surface p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <ReviewAvatar src={r.avatar} />
                  <div>
                    <div
                      role="img"
                      aria-label={`${r.stars} out of 5 stars`}
                      className="flex gap-0.5 text-[#e8a200]"
                    >
                      {Array.from({ length: 5 }, (_, n) => (
                        <Star
                          key={n}
                          aria-hidden="true"
                          className="size-4"
                          strokeWidth={1.25}
                          fill={n < r.stars ? "#fbbc04" : "none"}
                        />
                      ))}
                    </div>
                    <p className="mt-2 font-semibold">
                      {r.name}
                      {r.city ? (
                        <span className="font-normal text-text-muted">
                          , {r.city}
                        </span>
                      ) : null}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-text-muted">
                  {STATUS_LABEL[r.status]}
                </p>
              </div>
              <p className="mt-3 max-w-prose text-[0.9375rem] leading-relaxed">
                {r.body}
              </p>
              {r.photos.length > 0 ? (
                <ul className="mt-3 flex flex-wrap gap-2" aria-label="Photos">
                  {r.photos.map((src) => (
                    <li
                      key={src}
                      className="relative size-20 overflow-hidden border border-border bg-linen"
                    >
                      <a href={src} target="_blank" rel="noopener noreferrer" aria-label={`Open photo from ${r.name} full size (opens in a new tab)`} className="absolute inset-0">
                        <SiteImage src={src} alt="" fill sizes="80px" className="object-cover" />
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {r.status === "approved" ? (
                  <Act id={r.id} status="hidden">
                    Hide
                  </Act>
                ) : (
                  <Act id={r.id} status="approved">
                    Show
                  </Act>
                )}
                <ActionForm
                  action={deleteReviewAction}
                  className="inline-block"
                >
                  <input type="hidden" name="id" value={r.id} />
                  <SubmitButton variant="danger" pendingLabel="Deleting…">
                    Delete
                  </SubmitButton>
                </ActionForm>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
