import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/json-ld";
import { PageIntro, Prose } from "@/components/public/prose";
import { publicEnv } from "@/lib/env";
import { getBusinessSettings } from "@/lib/settings";

const TITLE = "Timber and care guide";
const DESCRIPTION = "How to choose the wood for a piece of furniture, what stain, polish and oil do, and how to look after solid wood furniture at home.";

export const metadata: Metadata = { title: TITLE, description: DESCRIPTION, alternates: { canonical: "/guide" } };
export const revalidate = 3600;

/** General advice about solid wood furniture. Which woods and finishes are on offer at any time is for the showroom to say. */
const GUIDE = `## Solid wood, in short

Solid wood furniture is made from planks cut straight from the tree, not from layers, chips or a thin veneer. It is strong, it can be sanded and refinished if it is marked in years to come, and it ages well.

## Choosing the wood

Woods fall into two groups. Hardwoods, such as teak, mahogany, oak and walnut, come from broad-leaved trees and are generally denser and more hard-wearing. Softwoods, such as pine, are lighter and usually more affordable, and they show more of their knots and soft grain.

- Teak: golden to mid brown, naturally oily, and a good choice for pieces that are used hard every day.
- Mahogany: reddish brown with a fine, even grain that takes a polish well.
- Oak: strong, pale to golden brown, with a pronounced grain.
- Walnut: deep chocolate brown with a smooth, flowing grain.
- Jak: golden yellow when freshly cut, darkening over time to a rich brown.
- Pine: pale and light, with visible knots, and the most affordable of these.

Which woods we have changes from time to time, so ask what is in the showroom or tell us the wood you would like for a made-to-measure piece.

## Why dry timber matters

Wood takes up and gives off moisture as the air changes, and it swells and shrinks as it does. Timber that has been properly dried before it is made into furniture is far less likely to warp, split or open at the joints. Every piece we make starts with dried timber.

## Stain, polish and oil

A finish protects the wood and brings out its character. A stain changes the colour. A clear coat, such as lacquer or polish, forms a protective layer on the surface. An oil soaks into the wood and leaves a natural, low-sheen look. The sheen can be matt, satin or gloss, and a sample can be checked against the wood before it is applied to your piece.

## Looking after solid wood

- Wipe with a soft, slightly damp cloth, then dry it straight away.
- Wipe spills at once, and use coasters and mats under hot or wet things.
- Keep wood out of strong direct sunlight and away from heaters and cookers, which fade and dry it.
- Allow air to move around a piece and keep it a little away from damp walls, as the air here is humid.
- Avoid harsh cleaners and abrasive pads, which can dull or scratch the finish.
- Re-oil or re-polish a piece now and then if the surface starts to look dry.`;

export default async function GuidePage() {
  const business = await getBusinessSettings();
  const site = publicEnv().NEXT_PUBLIC_SITE_URL;
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: TITLE,
          description: DESCRIPTION,
          mainEntityOfPage: `${site}/guide`,
          author: { "@id": `${site}/#business` },
          publisher: { "@id": `${site}/#business` },
          about: business.name,
        }}
      />
      <PageIntro back={{ href: "/", to: "home" }} eyebrow="Guide" title={TITLE} lead="Choosing wood, understanding finishes, and keeping your furniture looking its best." />
      <div className="container-page py-[var(--section-space)]">
        <Prose text={GUIDE} />
        <p className="mt-10 flex flex-wrap gap-x-8 gap-y-3">
          <Link href="/products" className="link-arrow text-text">
            Browse the collection
          </Link>
          <Link href="/custom#quotation" className="link-arrow text-text">
            Request a quotation
          </Link>
          <Link href="/contact" className="link-arrow text-text">
            Ask us a question
          </Link>
        </p>
      </div>
    </>
  );
}
