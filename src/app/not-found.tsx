import { ButtonLink } from "@/components/ui/button";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main id="main" className="container-page py-24 text-center">
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-text-muted">404</p>
      <h1 className="font-display mt-4 text-4xl text-walnut">We couldn&rsquo;t find that page</h1>
      <p className="mx-auto mt-4 max-w-md text-text-muted">The address may be mistyped, or the page may have moved.</p>
      <div className="mt-8">
        <ButtonLink href="/">Back to the homepage</ButtonLink>
      </div>
    </main>
  );
}
