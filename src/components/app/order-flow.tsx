import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { nextStep, orderSteps, type FlowOrder } from "@/lib/order-flow";
import { formatDateTime } from "@/lib/time";

/**
 * The order's journey, written for this order: how it reaches the customer, how they pay, the steps in between (a pickup has no "out for
 * delivery"), what to do next, and when "paid" is recorded for this payment method.
 */
export function OrderFlow({ order, timezone }: { order: FlowOrder; timezone: string }) {
  const steps = orderSteps(order);
  const next = nextStep(order);

  return (
    <section aria-label="How this order works" className="mb-6 border border-border bg-surface">
      <ol className="grid gap-x-2 gap-y-4 px-4 py-5 sm:grid-flow-col sm:auto-cols-fr" aria-label="Order steps">
        {steps.map((s, i) => (
          <li key={s.key} className="flex min-w-0 items-start gap-3 sm:flex-col sm:items-center sm:text-center" aria-current={s.state === "current" ? "step" : undefined}>
            <span className="relative flex shrink-0 items-center sm:w-full sm:justify-center">
              {i > 0 ? <span aria-hidden="true" className={cn("absolute right-1/2 top-1/2 hidden h-0.5 w-full -translate-y-1/2 sm:block", s.state === "todo" ? "bg-border" : "bg-success")} /> : null}
              <span
                className={cn(
                  "relative z-10 flex size-7 items-center justify-center border-2 text-xs font-semibold",
                  s.state === "done" && "border-success bg-success text-white",
                  s.state === "current" && "border-walnut-dark bg-surface text-walnut-dark ring-2 ring-walnut/30",
                  s.state === "todo" && "border-border-strong bg-surface text-text-muted",
                )}
              >
                {s.state === "done" ? <Check aria-hidden="true" className="size-4" strokeWidth={3} /> : i + 1}
              </span>
            </span>
            <span className="min-w-0">
              <span className={cn("block text-sm", s.state === "current" ? "font-semibold text-text" : s.state === "done" ? "font-medium text-text" : "text-text-muted")}>{s.label}</span>
              <span className="block text-[0.7rem] leading-tight text-text-muted">{s.at ? formatDateTime(s.at, timezone) : " "}</span>
            </span>
          </li>
        ))}
      </ol>

      <div className="border-t border-border px-4 py-3">
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Next step</h3>
        <p className="text-sm">{order.status === "cancelled" ? "This order was cancelled. Nothing more to do unless it is reopened." : order.status === "refunded" ? "This order has been refunded and its items are back in stock. Nothing more to do." : next ?? "Completed: the order is finished and paid."}</p>
      </div>
    </section>
  );
}
