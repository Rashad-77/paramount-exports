import type { LucideIcon } from "lucide-react";
import { Inbox, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Nothing to show yet. Say what belongs here and offer the next action if one exists. */
export function EmptyState({
  title,
  description,
  action,
  icon: Icon = Inbox,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-3 rounded-[var(--radius-lg)] border border-dashed border-border px-6 py-12 text-center", className)}>
      <Icon aria-hidden="true" className="size-8 text-stone" strokeWidth={1.25} />
      <div className="max-w-md">
        <p className="font-medium text-text">{title}</p>
        {description ? <p className="mt-1 text-sm text-text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

/** Something failed. Never pass raw error text from the server — use a safe message. */
export function ErrorState({
  title = "This page could not be loaded",
  description = "Please try again. If the problem continues, let the office know.",
  action,
  className,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div role="alert" className={cn("flex flex-col items-center gap-3 rounded-[var(--radius-lg)] border border-danger/30 bg-danger-bg px-6 py-12 text-center", className)}>
      <TriangleAlert aria-hidden="true" className="size-8 text-danger" strokeWidth={1.25} />
      <div className="max-w-md">
        <p className="font-medium text-text">{title}</p>
        <p className="mt-1 text-sm text-text-muted">{description}</p>
      </div>
      {action}
    </div>
  );
}

/** Skeleton block for loading.tsx files. Decorative; announces nothing. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-[var(--radius-md)] bg-linen", className)} />;
}

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="space-y-4">
      <span className="sr-only">{label}…</span>
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}
