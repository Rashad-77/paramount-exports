import { Printer } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

/** Opens the order's receipt (a proper document laid out for A4) in a new tab; print or save it as a PDF from there. */
export function PrintButton({ href }: { href: string }) {
  return (
    <ButtonLink href={href} target="_blank" rel="noopener">
      <Printer aria-hidden="true" className="size-4" /> Receipt
    </ButtonLink>
  );
}
