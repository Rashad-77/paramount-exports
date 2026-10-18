import { redirect } from "next/navigation";

/** Adding a category is a pop-up on the list now; this address (still linked from a few places) opens it. */
export default function NewCategoryPage() {
  redirect("/app/categories?add=1");
}
