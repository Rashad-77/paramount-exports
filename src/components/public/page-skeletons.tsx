import { Skeleton } from "@/components/ui/states";

/** Grey placeholders shown by loading.tsx files while a page is being prepared; each roughly matches the layout of the page it stands in for. */

/** A title and a short line, as at the top of the Collection and category pages. */
function TitleBlock() {
  return (
    <div className="container-page pt-28 pb-8">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-4 h-10 w-2/3 max-w-md" />
      <Skeleton className="mt-4 h-4 w-full max-w-lg" />
    </div>
  );
}

/** The Collection and category pages: the title, the filter bar and a grid of product cards. */
export function CatalogueSkeleton() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Loading the collection…</span>
      <TitleBlock />
      <div className="bg-white pb-16 pt-4">
        <div className="container-page">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-11" />
            ))}
          </div>
          <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i}>
                <Skeleton className="aspect-[4/5] w-full" />
                <Skeleton className="mx-auto mt-4 h-4 w-3/4" />
                <Skeleton className="mx-auto mt-2 h-3 w-1/3" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** A product page: the photograph on one side, the name, the price and some lines of text on the other. */
export function ProductSkeleton() {
  return (
    <div role="status" aria-live="polite" className="container-page pb-14 pt-28">
      <span className="sr-only">Loading the product…</span>
      <div className="grid gap-10 md:grid-cols-2 md:gap-8 lg:gap-14">
        <Skeleton className="aspect-[4/5] w-full" />
        <div>
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-4 h-10 w-3/4" />
          <Skeleton className="mt-6 h-4 w-1/3" />
          <Skeleton className="mt-6 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-11/12" />
          <Skeleton className="mt-2 h-4 w-4/5" />
          <Skeleton className="mt-8 h-12 w-48" />
        </div>
      </div>
    </div>
  );
}

/** A simple page: a title and a few lines (order tracking, for instance). */
export function PageSkeleton() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <TitleBlock />
      <div className="container-page pb-16">
        <Skeleton className="h-40 w-full max-w-2xl" />
      </div>
    </div>
  );
}
