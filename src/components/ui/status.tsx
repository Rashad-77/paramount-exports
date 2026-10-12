import { AlertTriangle, CheckCircle2, Circle, Info, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type Tone = "neutral" | "info" | "success" | "warning" | "danger";

const toneStyles: Record<Tone, { box: string; Icon: typeof Info }> = {
  neutral: { box: "bg-linen text-text border-border", Icon: Circle },
  info: { box: "bg-info-bg text-info border-info/30", Icon: Info },
  success: { box: "bg-success-bg text-success border-success/30", Icon: CheckCircle2 },
  warning: { box: "bg-warning-bg text-warning border-warning/30", Icon: AlertTriangle },
  danger: { box: "bg-danger-bg text-danger border-danger/30", Icon: XCircle },
};

/**
 * Status label. Colour is always paired with an icon AND text, so status never relies on colour alone.
 * Keep the label factual ("Overdue", "Low stock"), not decorative.
 */
export function StatusBadge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  const { box, Icon } = toneStyles[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        box,
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={2} />
      {children}
    </span>
  );
}

/** Inline message. Use role="alert" only for errors/warnings that need immediate attention. */
export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: Exclude<Tone, "neutral">;
  title?: string;
  children?: ReactNode;
  className?: string;
}) {
  const { box, Icon } = toneStyles[tone];
  const urgent = tone === "danger" || tone === "warning";
  return (
    <div role={urgent ? "alert" : "status"} className={cn("flex gap-3 rounded-[var(--radius-md)] border p-4", box, className)}>
      <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0" strokeWidth={1.75} />
      <div className="min-w-0 text-sm">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={cn(title && "mt-1", "text-text")}>{children}</div> : null}
      </div>
    </div>
  );
}
