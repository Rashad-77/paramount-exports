import { redirect } from "next/navigation";

/** Addresses now live on the profile page. */
export default function AccountAddressesPage() {
  redirect("/account/profile#address-form");
}
