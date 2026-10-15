import { redirect } from "next/navigation";

/** Settings became My Profile and Password & Security. */
export default function AccountSettingsPage() {
  redirect("/account/profile");
}
