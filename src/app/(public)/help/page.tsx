import type { Metadata } from "next";
import Link from "next/link";
import { PageIntro } from "@/components/public/prose";
import { Reveal } from "@/components/public/reveal";

export const metadata: Metadata = {
  title: "We are here to help you",
  description: "How to order, how delivery and payment work, and what to do if you need to change something.",
  alternates: { canonical: "/help" },
};
export const revalidate = 300;

const TOPICS = [
  { id: "ordering", label: "How to order" },
  { id: "payment", label: "Delivery and payment" },
  { id: "custom", label: "Made to measure" },
  { id: "changes", label: "Changes and cancellations" },
];

export default async function HelpPage() {
  return (
    <>
      <PageIntro back={{ href: "/", to: "home" }} plain eyebrow="Customer support" title="We are here to help you" lead="What happens from choosing a piece to having it in your room, in plain words." />

      <div className="container-page pb-[var(--section-space)] pt-6 md:pt-[var(--section-space)]">
        <nav aria-label="On this page" className="help-topics flex flex-wrap justify-center gap-x-8 gap-y-3 border-b border-border pb-6 text-center">
          {TOPICS.map((t) => (
            <a key={t.id} href={`#${t.id}`} className="link-arrow text-text">
              {t.label}
            </a>
          ))}
        </nav>

        <div className="mx-auto mt-12 max-w-3xl space-y-14">
          <Reveal variant="fade">
            <section id="ordering" className="scroll-mt-28" aria-labelledby="ordering-title">
              <p className="eyebrow">Step by step</p>
              <h2 id="ordering-title" className="font-display mt-3 text-headline text-text">
                How to order
              </h2>
              <ol className="mt-6 space-y-5 text-[clamp(0.8438rem,calc(0.8438rem_+_(100vw_-_375px)_*_0.00381),0.9375rem)] leading-relaxed text-text-muted">
                {[
                  ["Choose", "Open a piece, pick the size or finish you want and add it to your order. You can add as many pieces as you like."],
                  ["Check out", "Tell us your name and phone number, whether you would like it delivered or want to collect it, and how you plan to pay. You are not charged anything on this website."],
                  ["We confirm", "We call or message you to confirm your order and agree the details with you. You will have an order number, which you can use to follow your order any time."],
                ].map(([t, b], i) => (
                  <li key={t} className="flex gap-5">
                    <span className="font-display w-9 shrink-0 text-[clamp(1.15rem,calc(1.15rem_+_(100vw_-_375px)_*_0.01425),1.5rem)] leading-none text-timber">{String(i + 1).padStart(2, "0")}</span>
                    <span>
                      <span className="block font-medium text-text">{t}</span>
                      {b}
                    </span>
                  </li>
                ))}
              </ol>
              <p className="mt-6">
                <Link href="/track" className="link-arrow text-text">
                  Track your order
                </Link>
              </p>
            </section>
          </Reveal>

          <Reveal variant="fade">
            <section id="payment" className="scroll-mt-28 border-t border-border pt-12" aria-labelledby="payment-title">
              <p className="eyebrow">Delivery and payment</p>
              <h2 id="payment-title" className="font-display mt-3 text-headline text-text">
                Pay when it arrives
              </h2>
              <div className="mt-6 space-y-4 text-[clamp(0.8438rem,calc(0.8438rem_+_(100vw_-_375px)_*_0.00381),0.9375rem)] leading-relaxed text-text-muted">
                <p>
                  <strong className="font-medium text-text">Nothing is paid online.</strong> This website never asks for card or bank details. You pay us directly, in one of the ways below.
                </p>
                <ul className="space-y-2">
                  <li>
                    <strong className="font-medium text-text">Pay on delivery</strong> when your order is delivered to you.
                  </li>
                  <li>
                    <strong className="font-medium text-text">Bank transfer.</strong> Please wait until we have confirmed your order, then transfer and quote your order number. We give you our bank details when we confirm.
                  </li>
                  <li>
                    <strong className="font-medium text-text">Pay at the showroom</strong> if you are collecting your order yourself.
                  </li>
                </ul>
                <p>
                  <strong className="font-medium text-text">Delivery.</strong> The delivery charge depends on where it is going, so we agree it with you when we call to confirm, together with the day. If you would rather collect, the order is ready for you at the showroom and we tell you when.
                </p>
                <p>We mark your order as paid when we have received the payment, and you can see that when you track your order.</p>
              </div>
            </section>
          </Reveal>

          <Reveal variant="fade">
            <section id="custom" className="scroll-mt-28 border-t border-border pt-12" aria-labelledby="custom-title">
              <p className="eyebrow">Custom work</p>
              <h2 id="custom-title" className="font-display mt-3 text-headline text-text">
                Made to measure
              </h2>
              <p className="mt-6 text-[clamp(0.8438rem,calc(0.8438rem_+_(100vw_-_375px)_*_0.00381),0.9375rem)] leading-relaxed text-text-muted">
                If you need a different size, wood or finish, or something that is not in the collection, tell us what you have in mind on the custom enquiry page. We reply with a quotation, and no work starts until you agree it.
              </p>
              <p className="mt-4">
                <Link href="/custom#quotation" className="link-arrow text-text">
                  Request quotation
                </Link>
              </p>
            </section>
          </Reveal>

          <Reveal variant="fade">
            <section id="changes" className="scroll-mt-28 border-t border-border pt-12" aria-labelledby="changes-title">
              <p className="eyebrow">Need to change something?</p>
              <h2 id="changes-title" className="font-display mt-3 text-headline text-text">
                Changes and cancellations
              </h2>
              <p className="mt-6 text-[clamp(0.8438rem,calc(0.8438rem_+_(100vw_-_375px)_*_0.00381),0.9375rem)] leading-relaxed text-text-muted">
                An order cannot be edited on the website once it is placed. If you need to correct something, change a piece or cancel, please contact us and quote your order number, and we will sort it out with you.
              </p>
              <p className="mt-4">
                <Link href="/contact" className="link-arrow text-text">
                  Contact us
                </Link>
              </p>
            </section>
          </Reveal>
        </div>
      </div>
    </>
  );
}
