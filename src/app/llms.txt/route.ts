import { publicEnv } from "@/lib/env";
import { getBusinessSettings, isPlaceholderBusiness } from "@/lib/settings";
import { internationalPhone, placeOf } from "@/lib/structured-data";
import { listPublicCategories } from "@/server/catalogue-public";

export const revalidate = 3600;

/**
 * A plain-text summary of the business for AI assistants (the llms.txt convention): who we are, where, how to reach us, what we make and
 * where to read more. Built only from the details saved under Settings and the categories shown on the website.
 */
export async function GET() {
  const business = await getBusinessSettings();
  const site = publicEnv().NEXT_PUBLIC_SITE_URL;
  if (isPlaceholderBusiness(business)) return new Response("", { status: 404 });
  const place = placeOf(business.address);
  const main = (await listPublicCategories().catch(() => [])).filter((c) => !c.parentId).map((c) => c.name);
  const phones = [business.phone, business.phoneAlt].map((p) => internationalPhone(p, business.phoneCountryCode)).filter(Boolean);
  const hours = (business.openingHours ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const address = (business.address ?? "").split(/\r?\n/).map((l) => l.trim().replace(/[,\s]+$/, "")).filter(Boolean).join(", ");

  const lines = [
    `# ${business.name}`,
    "",
    `> ${business.name} makes solid wood furniture${place ? ` in ${place}` : ""}: ready-made pieces from the showroom, and furniture made to the customer's measurements in the wood and finish they choose.`,
    "",
    "## Contact",
    ...(address ? [`- Showroom and workshop: ${address}`] : []),
    ...(phones.length ? [`- Telephone: ${phones.join(", ")}`] : []),
    ...(business.email ? [`- Email: ${business.email}`] : []),
    ...(hours.length ? [`- Opening hours: ${hours.join("; ")}`] : []),
    ...(business.mapUrl ? [`- Map: ${business.mapUrl}`] : []),
    "",
    ...(main.length ? ["## What we make", ...main.map((n) => `- ${n}`), ""] : []),
    "## Pages",
    `- [Collection](${site}/products): the pieces on sale, by category and material`,
    `- [Custom furniture](${site}/custom): furniture made to measurements, with a quotation before any work starts`,
    `- [About us](${site}/about): who we are and how a piece is made, from timber selection to finishing`,
    `- [Timber and care guide](${site}/guide): choosing wood and looking after solid wood furniture`,
    `- [Support](${site}/help): how ordering, delivery and payment work (payment is made to us directly, never online)`,
    `- [Gallery](${site}/gallery): photographs of the showroom and workshop`,
    `- [Contact](${site}/contact): address, opening hours, map and enquiry form`,
    "",
  ];
  return new Response(lines.join("\n"), { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
