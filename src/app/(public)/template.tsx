import type { ReactNode } from "react";

/** A template (unlike a layout) is created afresh on every navigation, so each page eases in as you arrive on it. */
export default function PublicTemplate({ children }: { children: ReactNode }) {
  return <div className="route-in">{children}</div>;
}
