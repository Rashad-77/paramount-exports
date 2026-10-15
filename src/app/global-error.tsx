"use client";

/** Last-resort boundary (root layout failed). Self-contained: no design-system imports that could also fail. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#f6f3ed", color: "#252522", padding: "4rem 1.5rem" }}>
        <main style={{ maxWidth: "32rem", margin: "0 auto" }}>
          <h1 style={{ fontSize: "1.5rem" }}>Something went wrong</h1>
          <p>The page could not be displayed. Please try again.</p>
          <button
            type="button"
            onClick={reset}
            style={{ minHeight: "2.75rem", padding: "0 1.25rem", background: "#49372c", color: "#f6f3ed", border: 0, borderRadius: 4 }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
