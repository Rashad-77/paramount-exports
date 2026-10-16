import { redirect } from "next/navigation";

/** Password and account settings now live on the profile page. */
export default function AccountSecurityPage() {
  redirect("/account/profile#password-title");
}
