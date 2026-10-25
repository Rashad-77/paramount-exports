import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type AvailabilityState = "in_stock" | "made_to_order" | "sold";

/** Fill for each state: green when it is in stock, grey when it is made to order, red when none is left. White text passes contrast on all three. */
const FILL: Record<AvailabilityState, string> = {
  in_stock: "bg-[#2e7d32]",
  made_to_order: "bg-[#6b6560]",
  sold: "bg-[#c0392b]",
};

/** The availability label on a product page: a solid, square-cornered tag in capitals, coloured by state. */
export function AvailabilityTag({ state, children, className }: { state: AvailabilityState; children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center px-[11px] py-[7px] text-[clamp(0.6875rem,calc(0.6875rem_+_(100vw_-_375px)_*_0.00254),0.75rem)] font-medium uppercase leading-none tracking-[0.16em] text-white", FILL[state], className)}>{children}</span>;
}
