import type { ReactNode } from "react";
import { ReceiptToolbar, type ToolbarLink } from "./receipt-toolbar";
import styles from "./receipt.module.css";

/** The grey page around the sheet, with the toolbar above it (the toolbar is never printed). */
export function ReceiptShell({ backHref, backLabel, links, auto, children }: { backHref?: string; backLabel?: string; links?: ToolbarLink[]; auto: boolean; children: ReactNode }) {
  return (
    <div className={styles.screen}>
      <ReceiptToolbar backHref={backHref} backLabel={backLabel} links={links} auto={auto} />
      {children}
    </div>
  );
}
