import type { ReactNode } from "react";
// The sign-in screens use the staff area's typeface; the public site does not, so only these screens download it.
import "@fontsource-variable/inter";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return children;
}
