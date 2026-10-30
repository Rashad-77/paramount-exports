/**
 * Shown the moment an account page is asked for (My orders, Wishlist and the others), while the page itself is still being prepared,
 * so the visitor sees the place filling at once instead of waiting on the old page.
 */
export default function AccountLoading() {
  return (
    <section aria-busy="true" aria-label="Loading" className="acct-card">
      <div className="animate-pulse space-y-5" aria-hidden="true">
        <div className="h-6 w-44 bg-linen" />
        <div className="h-10 w-full max-w-md bg-linen" />
        <div className="space-y-3">
          <div className="h-16 w-full bg-linen" />
          <div className="h-16 w-full bg-linen" />
          <div className="h-16 w-full bg-linen" />
        </div>
      </div>
    </section>
  );
}
