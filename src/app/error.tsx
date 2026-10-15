"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";

/** Route-level error boundary. Shows a generic message only — never the error text or stack. */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // The digest links this report to the server log entry; the message is not shown to the user.
    console.error("Route error", error.digest ?? "no-digest");
  }, [error]);

  return (
    <div className="container-page py-16">
      <ErrorState
        action={<Button onClick={reset}>Try again</Button>}
        description={error.digest ? `If you contact us, quote reference ${error.digest}.` : undefined}
      />
    </div>
  );
}
