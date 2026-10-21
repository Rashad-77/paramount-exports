import type { ReactNode } from "react";
import { TD, TH, TR } from "@/components/ui/table";

/**
 * One line of a settings-style table: its name in the shaded cell, the box to fill in (or the value to read) beside it. A box keeps its own
 * label for screen readers; the shaded cell is what sighted people read. Use `plain` for text rather than a box.
 */
export function SettingRow({ label, required, plain, note, children }: { label: string; required?: boolean; plain?: boolean; note?: string; children: ReactNode }) {
  return (
    <TR className="hover:bg-transparent">
      <TH scope="row" className={"w-64 border-r border-border align-top text-left " + (plain ? "" : "pt-5")}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
        {note ? <span className="mt-1 block whitespace-normal text-xs font-normal normal-case leading-snug tracking-normal text-text-muted">{note}</span> : null}
      </TH>
      <TD className="py-3 [&_label]:sr-only">{children}</TD>
    </TR>
  );
}
