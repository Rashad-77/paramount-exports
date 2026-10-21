"use client";

import { Phone } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";

/** True on a phone or tablet, where a tel: link starts a call. A computer has nothing to answer it, so the link does nothing there. */
const canDial = () => typeof navigator !== "undefined" && navigator.maxTouchPoints > 0 && /Android|iPhone|iPad|Mobi/i.test(navigator.userAgent);

/**
 * "Call" for a staff page. On a phone it starts the call. On a computer it copies the number and says so, so the button always does
 * something useful instead of silently doing nothing.
 */
export function CallButton({ phone }: { phone: string }) {
  const number = phone.replace(/\s+/g, "");
  return (
    <a
      href={`tel:${number}`}
      className={buttonClasses("secondary")}
      onClick={async (e) => {
        if (canDial()) return;
        e.preventDefault();
        try {
          await navigator.clipboard.writeText(number);
          toast(`${number} copied. Paste it into your phone or softphone to call.`);
        } catch {
          toast(`The number is ${number}.`, "info");
        }
      }}
    >
      <Phone aria-hidden="true" className="size-4" strokeWidth={1.75} />
      Call
    </a>
  );
}
