import { Clock, Hammer, Handshake, Mail, MapPin, Phone, Quote, Ruler, Star, TreeDeciduous } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { WhatsAppIcon } from "@/components/public/whatsapp-icon";
import { CountUp } from "@/components/public/count-up";
import { HeroVideo } from "@/components/public/hero-video";
import { ImagePlaceholder } from "@/components/public/image-placeholder";
import { ReviewAvatar } from "@/components/public/review-avatar";
import { ReviewQuote } from "@/components/public/review-quote";
import { ReviewCardButton, ReviewsViewer, ViewAllButton } from "@/components/public/reviews-viewer";
import { SiteImage } from "@/components/public/site-image";
import { Reveal } from "@/components/public/reveal";
import { ScrollRow } from "@/components/public/scroll-row";
import { ButtonLink } from "@/components/ui/button";
import { mapEmbedUrl, whatsappLink } from "@/lib/contact";
import { hasDatabase } from "@/lib/env";
import { HERO_VIDEO } from "@/lib/home-media";
import { PROCESS } from "@/lib/process";
import { getBusinessSettings } from "@/lib/settings";
import { splitAddress } from "@/lib/address-lines";
import { googleReviewLink } from "@/lib/google-reviews";
import { ProductCard } from "@/components/public/product-card";
import { ReviewButton } from "@/components/public/review-button";
import { PremiumTeaser } from "@/components/public/premium";
import {
  listPremiumProducts,
  listPublicCategories,
  listPublicProducts,
} from "@/server/catalogue-public";
import { getGoogleReviews } from "@/server/google-reviews";
import { listApprovedReviews } from "@/server/reviews";

/** Placeholder reviews, shown only while Google has none to give. Replace by connecting Google reviews in Settings. Each carries a delivery address, and the card shows its city. */
const SAMPLE_REVIEWS = [
  { quote: "Our dining table arrived exactly as promised and the finish is beautiful. The team measured twice and fitted it in one visit.", name: "Nimali Perera", samplePhotos: 2, address: "24 Alfred House Gardens\nColombo 03\n\nColombo\n00300", stars: 5 },
  { quote: "I ordered a wardrobe built to my room size. The workmanship is excellent and they kept me updated through every stage.", name: "Rohan Fernando", address: "58 Peradeniya Road\nKandy\n\nKandy\n20000", stars: 5 },
  { quote: "Good quality timber, fair price and very helpful staff in the showroom. Delivery was on the day they said.", name: "Dilani Silva", samplePhotos: 1, address: "12 Church Street\nFort\n\nGalle\n80000", stars: 5 },
  { quote: "Replaced all the office desks with Paramount pieces. Sturdy, neat and well finished. Would order again.", name: "Kasun Wijesinghe", address: "7 Lewis Place\nNegombo\n\nNegombo\n11500", stars: 4 },
  { quote: "They fixed a small issue with my bed frame within days, no fuss at all. That is rare to find.", name: "Anjali Mendis", samplePhotos: 3, address: "31 Temple Road\nBambalapitiya\n\nColombo\n00400", stars: 5 },
  { quote: "Ordered a teak coffee table and two side tables. The grain is lovely and they matched the stain to my sofa exactly.", name: "Sanjeewa Rajapaksa", address: "18 Hill Street\nDehiwala\n\nDehiwala\n10350", stars: 5, samplePhotos: 2},
  { quote: "The workshop team walked me through every wood option before I chose. Honest advice, and the bookshelf is perfect.", name: "Thilini Jayawardena", address: "9 Lake Road\nNuwara Eliya\n\nNuwara Eliya\n22200", stars: 5},
  { quote: "Delivery to Matara was careful and on schedule. One drawer needed adjusting and they came back to fix it the same week.", name: "Chamara Gunasekara", address: "44 Beach Road\nMatara\n\nMatara\n81000", stars: 4, samplePhotos: 1},
  { quote: "We furnished our new guesthouse with Paramount beds and wardrobes. Guests keep asking where they were made.", name: "Priyanka Ratnayake", address: "5 Fort Road\nGalle\n\nGalle\n80000", stars: 5, samplePhotos: 3},
  { quote: "Fair price for solid wood, and a clear quotation before they started. The dining chairs are very comfortable.", name: "Mohamed Ifham", address: "62 Main Street\nKurunegala\n\nKurunegala\n60000", stars: 5},
  { quote: "We first visited the showroom on a Saturday with a rough sketch and a tight budget, and I honestly expected to be handed a catalogue and left alone. Instead, one of the team sat with us for almost an hour, explained the difference between the timbers, showed us how each finish ages, and helped us work out which pieces to buy now and which to leave for later. We ordered a dining table, six chairs and a sideboard. The quotation was clear, the delivery date was kept, and the two men who delivered carried everything upstairs without a single scratch. Three months on, the table has survived two birthday parties and a toddler with a marker pen, and a quick wipe and some oil brought it back like new. When one chair developed a small wobble, the workshop collected it, fixed it and returned it within the week at no charge. This is furniture made by people who care how it will look in your home ten years from now, and we have already told our families about it.", name: "Ishara Abeysekera", address: "27 Galle Road\nRatmalana\n\nRatmalana\n10390", stars: 5, samplePhotos: 3 },
];


// Settings and catalogue change rarely; refresh the static page at most every 5 minutes.
export const revalidate = 300;

/** One stagger step for every list on the page, so everything arrives with the same rhythm. */
const STEP = 90;
/** The product rows: always this many, with grey labelled placeholders making up the difference. */
const PRODUCT_ROWS = 7;
const PRODUCT_CARDS = 6;
/** Premium pieces whose photographs run in the homepage carousel. */
const PREMIUM_PIECES = 8;

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  if (!hasDatabase()) return fallback;
  try {
    return await fn();
  } catch (e) {
    console.error(
      "Homepage data unavailable",
      e instanceof Error ? e.message : "unknown",
    );
    return fallback;
  }
}

/** Eyebrow, light display headline and optional intro: the head of every section. */
function Head({
  id,
  eyebrow,
  title,
  intro,
  dark = false,
  center = false,
}: {
  id: string;
  eyebrow: string;
  title: ReactNode;
  intro?: string;
  dark?: boolean;
  center?: boolean;
}) {
  return (
    <Reveal
      variant="up"
      className={center ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}
    >
      <p className={"eyebrow " + (dark ? "eyebrow-light" : "")}>{eyebrow}</p>
      <h2
        id={id}
        className={
          "font-display mt-4 text-headline " +
          (dark ? "text-white" : "text-text")
        }
      >
        {title}
      </h2>
      {intro ? (
        <p
          className={
            "mt-4 max-w-xl fl-a leading-relaxed " +
            (dark ? "text-white/70" : "text-text-muted")
          }
        >
          {intro}
        </p>
      ) : null}
    </Reveal>
  );
}

const WHY = [
  {
    icon: TreeDeciduous,
    title: "Honest materials",
    body: "Solid timber chosen for the job, with the wood and the finish named on every piece.",
  },
  {
    icon: Ruler,
    title: "Made to measure",
    body: "Your dimensions, your wood and finish, agreed with you before we start.",
  },
  {
    icon: Hammer,
    title: "Built in our workshop",
    body: "Ready-made and custom pieces are made by the people whose showroom you can visit.",
  },
  {
    icon: Handshake,
    title: "Order your way",
    body: "Order online and pay on delivery, by bank transfer, or at the showroom.",
  },
];

const SERVICES = [
  {
    title: "Ready-made pieces",
    body: "See and sit at them on the showroom floor.",
  },
  {
    title: "Made to measure",
    body: "Built to your size, in your choice of wood.",
  },
  {
    title: "Wood and finish",
    body: "Choose the timber, the stain and the sheen.",
  },
  {
    title: "Delivery arranged",
    body: "We agree the charge and the day with you.",
  },
  { title: "Showroom visits", body: "Come and see the timber in person." },
  { title: "Pay when it arrives", body: "Nothing is charged on this website." },
];

const CARD_W = "w-[82%] shrink-0 snap-start sm:w-[22rem]";

export default async function HomePage() {
  const [business, categories, products, premium] = await Promise.all([
    getBusinessSettings(),
    safe(() => listPublicCategories(), []),
    safe(
      async () =>
        (await listPublicProducts({ page: 1 })).items.slice(0, PRODUCT_CARDS),
      [],
    ),
    safe(() => listPremiumProducts(PREMIUM_PIECES), []),
  ]);
  // Reviews: the ones customers wrote on the site (once approved), then Google's. With neither, the SAMPLE_REVIEWS below stand in; delete them once real ones are showing.
  const google = await getGoogleReviews(business.googlePlaceId);
  const own = await safe(() => listApprovedReviews(), []);
  const reviewLink = googleReviewLink(business);
  const reviews: Array<{
    id: string;
    quote: string;
    name: string | null;
    /** Where the customer is from: the city the reviewer gave, or the city in their delivery address. */
    city?: string | null;
    /** Photographs the customer added. */
    photos?: string[];
    /** The reviewer's profile picture (only for a customer with an account); blank otherwise. */
    avatar?: string | null;
    /** How many stand-in photo tiles to show on a sample review. */
    samplePhotos?: number;
    stars?: number;
  }> = [
    ...own.map((r) => ({ id: r.id, quote: r.body, name: r.name, city: r.city, photos: r.photos, avatar: r.avatar, stars: r.stars })),
    ...(google?.reviews ?? []).map((r, i) => ({
      id: `google-${i}`,
      quote: r.text,
      name: r.author,
      stars: r.rating,
    })),
  ];
  if (reviews.length === 0) reviews.push(...SAMPLE_REVIEWS.map((r, i) => ({ ...r, id: `sample-${i}`, city: splitAddress(r.address).city })));
  const viewerReviews = reviews.map((r) => ({ id: r.id, quote: r.quote, name: r.name, city: r.city ?? null, stars: r.stars, photos: r.photos ?? [], avatar: r.avatar ?? null, samplePhotos: r.samplePhotos ?? 0 }));
  // One band per group, with the categories under it as the note.
  const groups = categories.filter((c) => !c.parentId);
  const rows = groups.slice(0, PRODUCT_ROWS).map((g) => {
    const allKids = categories
      .filter((c) => c.parentId === g.id)
      .map((c) => c.name);
    // Up to twelve names fit a band comfortably; the rest are on the collection page.
    const kids = allKids.length > 12 ? [...allKids.slice(0, 12), "…"] : allKids;
    return {
      key: g.id,
      name: g.name,
      href: `/products?category=${g.slug}`,
      all: kids.join(" · "),
      lines:
        kids.length > 6
          ? [kids.slice(0, 5).join(" · "), kids.slice(5).join(" · ")]
          : [],
      note:
        kids.length > 0
          ? kids.slice(0, 4).join(" · ") + (kids.length > 4 ? " · …" : "")
          : g.count > 0
            ? `${g.count} ${g.count === 1 ? "piece" : "pieces"}`
            : "Made to order",
    };
  });
  const reach = [
    business.phone
      ? {
          icon: Phone,
          label: "Call us",
          value: business.phone,
          href: `tel:${business.phone.replace(/\s+/g, "")}`,
        }
      : null,
    business.phoneAlt
      ? {
          icon: Phone,
          label: "Call us",
          value: business.phoneAlt,
          href: `tel:${business.phoneAlt.replace(/\s+/g, "")}`,
        }
      : null,
    business.email
      ? {
          icon: Mail,
          label: "Email",
          value: business.email,
          href: `mailto:${business.email}`,
        }
      : null,
    business.whatsapp
      ? {
          icon: WhatsAppIcon,
          label: "WhatsApp",
          value: "WhatsApp",
          href: whatsappLink(business.whatsapp, business.phoneCountryCode),
        }
      : null,
  ].filter((x): x is NonNullable<typeof x> => x !== null);

  return (
    <>
      {/* 1. Hero */}
      <section aria-labelledby="hero-title" className="vhero on-wood">
        <HeroVideo
          desktop={HERO_VIDEO.desktop}
          mobile={HERO_VIDEO.mobile}
          poster={HERO_VIDEO.poster}
        />
        <div className="container-page w-full pt-28 pb-16">
          <div className="max-w-xl">
            <h1 id="hero-title" className="font-display mt-4">
              Expertise in woodworking, readymade or custom-built
            </h1>
            <p className="mt-5 max-w-md text-[clamp(1.0188rem,calc(1.0188rem_+_(100vw_-_375px)_*_0.00077),1.0625rem)] leading-relaxed text-white/80">
              Visit our showroom or order online.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/products" size="cta" variant="light">
                Browse collection
              </ButtonLink>
              <ButtonLink href="/contact#enquiry" size="cta" variant="onDark">
                Make enquiry
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>

      {/* 1b. The premium range: only once the owner has marked a piece premium */}
      <PremiumTeaser pieces={premium} />

      {/* 2. Why choose us */}
      <section aria-labelledby="why-title" className="sec sec-white">
        <div className="container-page">
          <div className="flex flex-col gap-10 md:flex-row md:items-end md:justify-between">
            <Head
              id="why-title"
              eyebrow="Our approach"
              title={`Why Choose ${business.name}`}
            />
            <Reveal
              variant="up"
              delay={STEP}
              className="years-mark shrink-0 md:text-right"
            >
              <p className="font-display text-[clamp(2.35rem,calc(2.35rem_+_(100vw_-_375px)_*_0.05569),5.5rem)] font-light leading-none tracking-[-0.03em] text-brand">
                <CountUp to={20} suffix="+" />
              </p>
              <p className="mt-3 text-[clamp(0.6875rem,calc(0.6875rem_+_(100vw_-_375px)_*_0.00110),0.75rem)] font-semibold uppercase tracking-[0.2em] text-text">
                Years of woodwork
              </p>
              <p className="mt-1.5 text-[clamp(0.7313rem,calc(0.7313rem_+_(100vw_-_375px)_*_0.00144),0.8125rem)] text-text-muted">
                Since 2006, in Kuruwita
              </p>
            </Reveal>
          </div>
          <ul className="mt-14 grid sm:grid-cols-2 lg:grid-cols-4">
            {WHY.map((w, i) => (
              <Reveal
                as="li"
                key={w.title}
                variant="up"
                delay={i * STEP}
                className="why-cell"
              >
                <w.icon
                  aria-hidden="true"
                  className="size-5 text-timber"
                  strokeWidth={1.25}
                />
                <h3 className="font-display mt-6 text-[clamp(1.0125rem,calc(1.0125rem_+_(100vw_-_375px)_*_0.00066),1.05rem)] leading-tight text-text">
                  {w.title}
                </h3>
                <p className="mt-3 text-[clamp(0.7313rem,calc(0.7313rem_+_(100vw_-_375px)_*_0.00144),0.8125rem)] leading-relaxed text-text-muted">
                  {w.body}
                </p>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* 3. Our products: one wide grey band per type of furniture, stacked with no gaps */}
      <section aria-labelledby="products-title" className="sec sec-cream">
        <div className="container-page">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <Head
              id="products-title"
              eyebrow="What we make"
              title="Our Products"
            />
            <Reveal variant="up" className="shrink-0 pb-1">
              <Link href="/products" className="link-arrow text-text">
                See the full collection{" "}

              </Link>
            </Reveal>
          </div>
        </div>
        <div>
          <ul className="mt-12">
            {rows.map((r, i) => (
              <Reveal as="li" key={r.key} variant="up" delay={i * 60}>
                <Link href={r.href} className="prow group">
                  <ImagePlaceholder
                    label={`${r.name} — photograph`}
                    className="absolute inset-0"
                    compact
                  />
                  <span className="container-page relative flex items-center justify-between gap-4">
                    <span className="min-w-0">
                      <span className="font-display block fl-b leading-tight text-text">
                        {r.name}
                      </span>
                      <span className="mt-2.5 grid max-w-[34rem] gap-1.5 fl-g font-semibold uppercase leading-snug tracking-[0.1em] text-text/70 sm:tracking-[0.16em]">
                        {r.lines.length > 0
                          ? r.lines.map((l) => <span key={l}>{l}</span>)
                          : r.all || r.note}
                      </span>
                    </span>

                  </span>
                </Link>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* 4. Browse the category: product cards, newest first */}
      <section aria-labelledby="projects-title" className="sec sec-white">
        <div className="container-page">
          <Head
            id="projects-title"
            eyebrow="Our collection"
            title="Browse the collection"
          />
          <ul className="mt-12 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-4">
            {products.map((p) => (
              <Reveal as="li" key={p.id} variant="up">
                <ProductCard product={p} currency={business.currency} />
              </Reveal>
            ))}
          </ul>
          <div className="mt-10">
            <Link href="/products" className="link-arrow text-text">
              See the full collection{" "}

            </Link>
          </div>
        </div>
      </section>

      {/* 5. Made for your space */}
      <section aria-labelledby="space-title" className="sec sec-white">
        <div className="container-page grid items-center gap-12 lg:grid-cols-[0.9fr_1fr] lg:gap-20">
          <Reveal variant="up">
            <div className="zoom-frame mx-auto aspect-[4/5] w-full max-w-sm lg:max-w-none">
              <ImagePlaceholder
                label="A finished piece in place"
                className="size-full"
                compact
              />
            </div>
          </Reveal>
          <div>
            <Reveal variant="up">
              <p className="eyebrow">Custom woodwork</p>
              <h2
                id="space-title"
                className="font-display mt-4 text-headline text-text"
              >
                Made for Your Space
              </h2>
              <p className="mt-4 max-w-md text-[clamp(0.8438rem,calc(0.8438rem_+_(100vw_-_375px)_*_0.00166),0.9375rem)] leading-relaxed text-text-muted">
                Choose something from the showroom floor, or tell us the size of
                the room and we will build to fit.
              </p>
            </Reveal>
            <ul className="mt-10 grid gap-x-8 sm:grid-cols-2">
              {SERVICES.map((s, i) => (
                <Reveal
                  as="li"
                  key={s.title}
                  variant="up"
                  delay={(i % 2) * 70}
                  className="svc"
                >
                  <h3 className="font-display text-[clamp(0.8563rem,calc(0.8563rem_+_(100vw_-_375px)_*_0.00166),0.95rem)] text-text">
                    {s.title}
                  </h3>
                  <p className="mt-1.5 text-[clamp(0.7313rem,calc(0.7313rem_+_(100vw_-_375px)_*_0.00144),0.8125rem)] leading-relaxed text-text-muted">
                    {s.body}
                  </p>
                </Reveal>
              ))}
            </ul>
            <Reveal variant="up" className="mt-8">
              <ButtonLink href="/custom#quotation" size="cta">
                Plan a custom piece
              </ButtonLink>
            </Reveal>
          </div>
        </div>
      </section>

      {/* 6. Craft: dark band with a collage and the process */}
      <section aria-labelledby="craft-title" className="sec sec-bark">
        <div className="container-page">
          <Head
            id="craft-title"
            eyebrow="Our craftsmanship"
            title={
              <>
                Made With Care.
                <br />
                Crafted From Wood.
              </>
            }
            intro="Every piece moves through the same sequence of hands and machines, from selecting the board to the final coat of finish."
            dark
          />
          <div className="mt-12">
            <Reveal variant="up">
              <div className="process-box">
                <p className="text-[clamp(0.6875rem,calc(0.6875rem_+_(100vw_-_375px)_*_0.00110),0.75rem)] font-semibold uppercase tracking-[0.22em] text-white/60">
                  Process
                </p>
                <ol>
                  {PROCESS.map((st, i) => (
                    <li key={st.title}>
                      <span aria-hidden="true">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="flex-1">
                        <span className="block fl-a text-white">
                          {st.title}
                        </span>
                        <span className="mt-1 block fl-c leading-snug text-white/65 sm:leading-relaxed">
                          {st.summary}
                        </span>
                      </span>
                    </li>
                  ))}
                </ol>
                <Link
                  href="/about#process"
                  className="link-arrow mt-6 self-start text-[var(--leaf)]"
                >
                  See the full process{" "}

                </Link>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* 7. About */}
      <section
        aria-labelledby="about-title"
        className="sec sec-white border-t border-border"
      >
        <div className="container-page">
          <div>
            <Reveal variant="up">
              <p className="eyebrow">About us</p>
              <h2
                id="about-title"
                className="font-display mt-4 text-headline text-text"
              >
                About {business.name}
              </h2>
              <p className="mt-5 max-w-lg fl-a leading-relaxed text-text-muted sm:mt-6">
                {business.tagline ??
                  "A showroom and workshop making ready-made and made-to-order wood furniture, from the choice of timber to the final finish."}
              </p>
              <p className="mt-3 max-w-lg fl-a leading-relaxed text-text-muted sm:mt-4">
                Come to the showroom to see the timber and the joinery in
                person, or order from home and have it delivered. Whether the
                job is a single piece or a whole room, the aim is the same:
                sound material, careful work and a straightforward service.
              </p>
              <Link href="/about" className="link-arrow mt-6 text-text">
                Read our story{" "}

              </Link>
            </Reveal>
          </div>
        </div>
      </section>

      {/* 8. Customer reviews: only Google's; with none yet, the section only invites a first review */}
      {reviews.length > 0 || reviewLink ? (
        <section
          aria-labelledby="reviews-title"
          className="sec sec-cream border-t border-border"
        >
          <ReviewsViewer reviews={viewerReviews}>
          {reviews.length === 0 ? (
            <div className="container-page">
              <Head
                id="reviews-title"
                eyebrow="Feedback"
                title="What Our Customers Say"
              />
              <p className="mt-4 text-[clamp(0.8438rem,calc(0.8438rem_+_(100vw_-_375px)_*_0.00166),0.9375rem)] text-text-muted">Been to the showroom or bought from us? Tell others what you think.</p>
            </div>
          ) : null}
          {reviews.length > 0 ? (
            <ScrollRow
              label="Customer reviews"
              autoplay
              centered
              header={
                <Head
                  id="reviews-title"
                  eyebrow="Feedback"
                  title="What Our Customers Say"
                />
              }
            >
              {/* A few reviews are repeated to fill the endless row; the repeats are hidden from screen readers */}
              {Array.from(
                { length: Math.max(reviews.length, 6) },
                (_, i) => reviews[i % reviews.length]!,
              ).map((t, i) => (
                <figure
                  key={i}
                  aria-hidden={i >= reviews.length ? true : undefined}
                  className={CARD_W + " soft-card relative flex flex-col !px-6 !py-6 transition-shadow duration-200 hover:shadow-md"}
                >
                  <ReviewCardButton id={t.id} name={t.name} />
                  {t.stars ? (
                    <div
                      role="img"
                      aria-label={`${t.stars} out of 5 stars`}
                      className="flex gap-0.5 text-[#e8a200]"
                    >
                      {Array.from({ length: 5 }, (_, n) => (
                        <Star
                          key={n}
                          aria-hidden="true"
                          className="size-5"
                          strokeWidth={1.25}
                          fill={n < t.stars! ? "#fbbc04" : "none"}
                        />
                      ))}
                    </div>
                  ) : (
                    <Quote
                      aria-hidden="true"
                      className="size-6 text-timber"
                      strokeWidth={1.25}
                    />
                  )}
                  {t.name ? (
                    <figcaption className="mt-4 flex items-center gap-3">
                      <ReviewAvatar src={t.avatar} />
                      <span className="min-w-0">
                        <span className="block text-[clamp(0.7313rem,calc(0.7313rem_+_(100vw_-_375px)_*_0.00144),0.8125rem)] font-semibold text-text">
                          {t.name}
                        </span>
                        {t.city ? (
                          <span className="mt-0.5 block text-[clamp(0.6875rem,calc(0.6875rem_+_(100vw_-_375px)_*_0.00110),0.75rem)] text-text-muted">
                            {t.city}
                          </span>
                        ) : null}
                      </span>
                    </figcaption>
                  ) : null}
                  <ReviewQuote id={t.id} quote={t.quote} />
                  {t.photos?.length || t.samplePhotos ? (
                    <ul className="mt-4 flex gap-2" aria-label="Photos from this customer">
                      {t.photos?.map((src) => (
                        <li key={src} className="relative size-14 overflow-hidden border border-border">
                          <SiteImage src={src} alt={`Photo from ${t.name ?? "a customer"}`} fill sizes="56px" className="object-cover" />
                        </li>
                      ))}
                      {Array.from({ length: t.samplePhotos ?? 0 }, (_, k) => (
                        <li key={k} className="relative size-14 overflow-hidden border border-border">
                          <ImagePlaceholder label="Sample customer photo" className="absolute inset-0" />
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </figure>
              ))}
            </ScrollRow>
          ) : null}
          {reviewLink || google?.rating || reviews.length > 0 ? (
            <div className={"container-page mt-10 flex flex-wrap items-center gap-x-6 gap-y-4 " + (reviews.length === 0 ? "justify-start" : "justify-center text-center")}>
              {google?.rating ? (
                <p className="text-[clamp(0.8438rem,calc(0.8438rem_+_(100vw_-_375px)_*_0.00166),0.9375rem)] text-text">
                  <span className="font-medium">
                    Rated {google.rating.toFixed(1)} out of 5 on Google
                  </span>
                  <span className="text-text-muted">
                    {" "}
                    from {google.total}{" "}
                    {google.total === 1 ? "review" : "reviews"}
                    {google.mapsUrl ? (
                      <>
                        {" · "}
                        <a
                          href={google.mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline"
                        >
                          See them all on Google
                          <span className="sr-only"> (opens in a new tab)</span>
                        </a>
                      </>
                    ) : null}
                  </span>
                </p>
              ) : null}
              {reviews.length > 0 ? <ViewAllButton /> : null}
              <ReviewButton reviewUrl={reviewLink} businessName={business.name}>
                Review us
              </ReviewButton>
            </div>
          ) : null}
          </ReviewsViewer>
        </section>
      ) : null}

      {/* 9. Contact: dark call to action */}
      <section aria-labelledby="cta-title" className="sec sec-cta">
        <div className="container-page">
          <Reveal variant="up" className="mx-auto max-w-2xl text-center">
            <h2
              id="cta-title"
              className="font-display text-headline text-white"
            >
              Let&rsquo;s Build Something Beautiful in Wood.
            </h2>
            <p className="mx-auto mt-5 max-w-md text-[clamp(0.8438rem,calc(0.8438rem_+_(100vw_-_375px)_*_0.00166),0.9375rem)] leading-relaxed text-white/70">
              Ask about a piece, request a quotation, or arrange a visit to the
              showroom.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <ButtonLink href="/contact" size="cta" variant="light">
                Contact us
              </ButtonLink>
              <ButtonLink href="/custom#quotation" size="cta" variant="onDark">
                Request a quotation
              </ButtonLink>
            </div>
          </Reveal>

          {/* The showroom: one warm-white card on the dark band, details on the left and the map on the right */}
          <Reveal variant="up" className="mx-auto mt-14 max-w-4xl">
            <div
              className={
                "grid gap-8 rounded-3xl bg-[var(--color-ivory)] p-6 text-text sm:p-8" +
                (mapEmbedUrl(business.mapUrl)
                  ? " md:grid-cols-[1.1fr_1fr]"
                  : "")
              }
            >
              <div>
                <p className="eyebrow">Visit the showroom</p>
                <h3 className="font-display mt-3 fl-b leading-tight text-text">
                  Come and see it in person.
                </h3>
                <ul className="mt-5 space-y-4 fl-d sm:mt-6 sm:space-y-5">
                  {business.address ? (
                    <li className="flex gap-4">
                      <MapPin
                        aria-hidden="true"
                        className="mt-0.5 size-4 shrink-0 text-timber"
                        strokeWidth={1.5}
                      />
                      <div>
                        <p className="font-medium">Address</p>
                        <div className="mt-0.5 whitespace-pre-line text-text-muted">
                          {business.address}
                        </div>
                      </div>
                    </li>
                  ) : null}
                  {business.openingHours ? (
                    <li className="flex gap-4">
                      <Clock
                        aria-hidden="true"
                        className="mt-0.5 size-4 shrink-0 text-timber"
                        strokeWidth={1.5}
                      />
                      <div>
                        <p className="font-medium">Opening hours</p>
                        <div className="mt-0.5 whitespace-pre-line text-text-muted">
                          {business.openingHours}
                        </div>
                      </div>
                    </li>
                  ) : null}
                  {reach.length > 0 ? (
                    <li className="flex gap-4">
                      <Phone
                        aria-hidden="true"
                        className="mt-0.5 size-4 shrink-0 text-timber"
                        strokeWidth={1.5}
                      />
                      <div>
                        <p className="font-medium">Get in touch</p>
                        <div className="mt-0.5 text-text-muted">
                          <ul className="space-y-1">
                            {reach.map((r) => (
                              <li key={r.href}>
                                <a
                                  href={r.href}
                                  className="transition-colors hover:text-text"
                                  {...(r.label === "WhatsApp"
                                    ? {
                                        target: "_blank",
                                        rel: "noopener noreferrer",
                                      }
                                    : {})}
                                >
                                  {r.value}
                                  {r.label === "WhatsApp" ? (
                                    <span className="sr-only">
                                      {" "}
                                      (opens in a new tab)
                                    </span>
                                  ) : null}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </li>
                  ) : null}
                </ul>
                <div className="mt-7">
                  {business.address && business.mapUrl ? (
                    <ButtonLink
                      href={business.mapUrl}
                      size="cta"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Get directions
                      <span className="sr-only"> (opens in a new tab)</span>
                    </ButtonLink>
                  ) : (
                    <ButtonLink href="/contact#enquiry" size="cta">
                      Send an enquiry
                    </ButtonLink>
                  )}
                </div>
              </div>
              {mapEmbedUrl(business.mapUrl) ? (
                <div className="relative min-h-[14rem] overflow-hidden rounded-2xl bg-[#e4e4e2]">
                  <iframe
                    title="Map showing the showroom"
                    src={mapEmbedUrl(business.mapUrl)!}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    className="absolute inset-0 size-full border-0"
                  />
                  {business.address && business.mapUrl ? (
                    <a
                      href={business.mapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="pill absolute left-3 top-3"
                    >
                      Open in maps{" "}

                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  ) : null}
                </div>
              ) : null}
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
