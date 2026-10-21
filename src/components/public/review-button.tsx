"use client";

import { Check, Copy, Star } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { submitReviewAction } from "@/app/(public)/review-actions";
import { ActionForm, FField, SubmitButton, useFormState } from "@/components/forms/action-form";
import { FileUploader } from "@/components/forms/file-uploader";
import { useAccountContact } from "@/components/public/signed-in-contact";
import { buttonClasses } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { splitAddress } from "@/lib/address-lines";
import { HONEYPOT_FIELD } from "@/lib/form-guard-constants";

const WORDS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];

/** What this device remembers about the reviewer, so a returning visitor is not asked again. */
const WHO_KEY = "pme-review-who";
const listeners = new Set<() => void>();
const readWho = () => {
  try {
    return localStorage.getItem(WHO_KEY);
  } catch {
    return null;
  }
};
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
};
function writeWho(v: { name: string; city: string } | null) {
  try {
    if (v) localStorage.setItem(WHO_KEY, JSON.stringify(v));
    else localStorage.removeItem(WHO_KEY);
  } catch {
    // storage blocked: the visitor is simply asked again next time
  }
  listeners.forEach((l) => l());
}
function useSavedWho(): { name: string; city: string } | null {
  const raw = useSyncExternalStore(subscribe, readWho, () => null);
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as { name?: unknown; city?: unknown };
    return typeof v.name === "string" && v.name && typeof v.city === "string" && v.city ? { name: v.name, city: v.city } : null;
  } catch {
    return null;
  }
}

/**
 * The Review pop-up. The customer picks their stars, writes their words, adds photographs and (unless their account or this device
 * already tells us) their name and city. That is saved on our website and shown on the homepage once approved. Google does not let
 * another website post a review for someone, so a second step copies the words and opens Google's own review box.
 */
function ReviewForm({ reviewUrl, onDone }: { reviewUrl: string; onDone: () => void }) {
  const { state } = useFormState();
  const me = useAccountContact();
  const saved = useSavedWho();
  const [editing, setEditing] = useState(false);
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  const [text, setText] = useState("");
  const [token, setToken] = useState("");
  const [copied, setCopied] = useState<"yes" | "blocked" | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  // What was typed in the name and city boxes: the browser clears them once the review is saved, so it is kept here.
  const typed = useRef({ name: "", city: "" });
  const shown = hover || stars;

  useEffect(() => {
    let alive = true;
    fetch("/api/form-token", { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { token: string }) => alive && setToken(j.token))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  // A saved review: remember who wrote it on this device.
  useEffect(() => {
    if (!state.ok) return;
    onDone();
    const val = (n: string) => wrap.current?.querySelector<HTMLInputElement>(`[name="${n}"]`)?.value.trim() ?? "";
    const name = typed.current.name || val("name");
    const city = typed.current.city || val("city");
    if (name && city) writeWho({ name, city });
  }, [state.ok, onDone]);

  const fromAccount = Boolean(me?.name);
  const accountCity = me?.address ? splitAddress(me.address).city : "";
  const remembered = !editing && !fromAccount ? saved : null;
  const name = me?.name || remembered?.name || "";
  const city = accountCity || remembered?.city || "";
  const stored = Boolean(remembered) && !accountCity;

  const postOnGoogle = async () => {
    const words = text.trim();
    let result: "yes" | "blocked" = "yes";
    if (words) {
      try {
        await navigator.clipboard.writeText(words);
      } catch {
        result = "blocked";
      }
    }
    setCopied(result);
    window.open(reviewUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <>
      <div
        ref={wrap}
        hidden={Boolean(state.ok)}
        className="space-y-5"
        onInput={(e) => {
          const t = e.target as HTMLInputElement;
          if (t.name === "name" || t.name === "city") typed.current[t.name] = t.value.trim();
        }}
      >
        <input type="hidden" name="formToken" value={token} />
        {/* Honeypot: visually hidden and skipped by keyboard and screen readers; humans never fill it. */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label>
            Leave this field empty
            <input type="text" name={HONEYPOT_FIELD} tabIndex={-1} autoComplete="off" />
          </label>
        </div>

        <fieldset className="text-center">
          <legend className="mb-3 w-full text-center text-sm font-medium">How would you rate us?</legend>
          <input type="hidden" name="stars" value={stars || ""} />
          <div className="flex items-center justify-center gap-1" onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={stars === n}
                aria-label={`${n} ${n === 1 ? "star" : "stars"}, ${WORDS[n]}`}
                onMouseEnter={() => setHover(n)}
                onFocus={() => setHover(n)}
                onBlur={() => setHover(0)}
                onClick={() => setStars(n)}
                data-on={n <= shown ? "true" : undefined}
                data-picked={n === stars ? "true" : undefined}
                style={{ "--i": n - 1 } as CSSProperties}
                className="rv-star p-1"
              >
                <Star aria-hidden="true" className="size-7" strokeWidth={1.25} />
              </button>
            ))}
          </div>
          <p className="mt-2 h-5 text-sm text-text-muted" aria-live="polite">
            {shown ? WORDS[shown] : ""}
          </p>
          {state.fieldErrors?.stars?.[0] ? (
            <p role="alert" className="text-sm text-danger">
              {state.fieldErrors.stars[0]}
            </p>
          ) : null}
        </fieldset>

        <div>
          <label htmlFor="review-text" className="mb-2 block text-sm font-medium">
            Your review
          </label>
          <textarea
            id="review-text"
            name="body"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={1000}
            rows={4}
            aria-invalid={state.fieldErrors?.body ? true : undefined}
            placeholder="What did you buy or order? How was the quality, the delivery and the service?"
            className="rv-field block w-full min-h-11 border border-border-strong bg-surface px-3 py-2 text-sm"
          />
          {state.fieldErrors?.body?.[0] ? (
            <p role="alert" className="mt-1 text-sm text-danger">
              {state.fieldErrors.body[0]}
            </p>
          ) : null}
        </div>

        <FileUploader name="fileIds" purpose="review" label="Add photos" hint="JPEG, PNG or WebP, up to 5 photos." maxFiles={5} />

        {name && city ? (
          <>
            <input type="hidden" name="name" value={name} />
            <input type="hidden" name="city" value={city} />
            <p className="text-center text-sm">
              Reviewing as{" "}
              <span className="font-semibold">
                {name}, {city}
              </span>
              {stored ? (
                <>
                  {" "}
                  <button type="button" onClick={() => setEditing(true)} className="underline">
                    Change
                  </button>
                </>
              ) : null}
            </p>
          </>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            {name ? <input type="hidden" name="name" value={name} /> : <FField name="name" kind="personName" label="Your name" autoComplete="name" maxLength={80} required defaultValue={saved?.name} />}
            {city ? <input type="hidden" name="city" value={city} /> : <FField name="city" kind="personName" label="Your city" autoComplete="address-level2" maxLength={80} required defaultValue={saved?.city} />}
          </div>
        )}

        {state.error ? (
          <p role="alert" className="text-sm text-danger">
            {state.error}
          </p>
        ) : null}

        <div className="flex justify-center">
          <SubmitButton size="md" pendingLabel="Sending…" className="rv-go min-w-40">
            Review
          </SubmitButton>
        </div>
      </div>

      {state.ok ? (
        <div className="space-y-5 text-center">
          <p role="status" className="rv-ok flex items-start justify-center gap-2 text-center text-sm text-success">
            <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {state.message}
          </p>
          <p className="text-sm">Want it on Google too? We will copy your words so you can paste them there.</p>
          <div className="flex justify-center">
            <button type="button" onClick={postOnGoogle} className={buttonClasses("secondary", "md", "min-w-40")}>
              Post on Google
            </button>
          </div>
          {copied ? (
            <p role="status" className="rv-ok flex items-start justify-center gap-2 text-center text-sm text-success">
              {copied === "yes" ? <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> : <Copy aria-hidden="true" className="mt-0.5 size-4 shrink-0" />}
              {copied === "yes" ? "Google has opened in a new tab. Paste your words there." : "Google has opened in a new tab. Select and copy your words from your review above, then paste them there."}
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

export function ReviewButton({
  reviewUrl,
  businessName,
  variant = "button",
  className,
  children = "Review us on Google",
}: {
  reviewUrl: string;
  businessName: string;
  variant?: "button" | "link";
  className?: string;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  // A new, empty form each time the pop-up is opened after a review was sent.
  const [round, setRound] = useState(0);
  const sent = useRef(false);
  const onDone = useCallback(() => {
    sent.current = true;
  }, []);

  const close = () => {
    setOpen(false);
    if (sent.current) {
      sent.current = false;
      setRound((r) => r + 1);
    }
  };

  return (
    <>
      {variant === "button" ? (
        <button type="button" onClick={() => setOpen(true)} className={buttonClasses("primary", "cta", className)} aria-haspopup="dialog">
          {children}
        </button>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className={className ?? "underline"} aria-haspopup="dialog">
          {children}
        </button>
      )}
      <Dialog open={open} onClose={close} title="Review us" description={`Tell others what it was like to deal with ${businessName}.`} className="rv-dialog">
        <ActionForm key={round} action={submitReviewAction}>
          <ReviewForm reviewUrl={reviewUrl} onDone={onDone} />
        </ActionForm>
      </Dialog>
    </>
  );
}
