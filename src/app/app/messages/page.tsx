import { redirect } from "next/navigation";
import { requireActor } from "@/lib/auth/session";

/** Messages are now two screens: quotation requests and enquiries. Old links and bookmarks end up on the right one. */
export default async function MessagesPage() {
  await requireActor();
  redirect("/app/enquiries");
}
