"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { LANG_COOKIE, LANG_NAME, type Lang } from "@/lib/i18n/lang";
import { startTranslator } from "@/lib/i18n/dom-translator";
import { toSinhala } from "@/lib/i18n/translate";

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: "en", setLang: () => undefined });

/** The language the dashboard is shown in, and a way to change it (the choice is remembered in a cookie). */
export const useLang = () => useContext(Ctx);

/**
 * Shows the dashboard in Sinhala by translating the words on the page as they are drawn (and as they change); see startTranslator. Only wording the
 * dictionary holds is translated: names (products, customers, Google Place ID, Facebook and so on), numbers, dates and anything else stay as they
 * are. English is always kept, so switching back restores the original words exactly.
 */
function Translator({ lang }: { lang: Lang }) {
  useEffect(() => {
    let stop: (() => void) | null = null;
    let cancelled = false;
    // Wait until the page has finished starting up (React has attached to the server's HTML) before changing any words.
    const begin = () => {
      if (!cancelled) stop = startTranslator(document.body, lang, toSinhala);
    };
    const timer = window.setTimeout(() => (document.readyState === "complete" ? begin() : window.addEventListener("load", () => window.setTimeout(begin, 60), { once: true })), document.readyState === "complete" ? 60 : 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      stop?.();
    };
  }, [lang]);
  return null;
}

/**
 * Wraps the dashboard: holds the language, marks the area with it (so Sinhala letters get a suitable font) and runs the translator.
 * `initial` is what the cookie said when the page was made.
 */
export function DashLanguage({ initial, children }: { initial: Lang; children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initial);
  const setLang = useCallback((l: Lang) => {
    document.cookie = `${LANG_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
    setLangState(l);
  }, []);
  const value = useMemo(() => ({ lang, setLang }), [lang, setLang]);
  return (
    <Ctx.Provider value={value}>
      <div lang={lang} className="contents">
        {children}
      </div>
      <Translator lang={lang} />
    </Ctx.Provider>
  );
}

/** The English / සිංහල switch: two buttons, the current language marked. */
export function LanguageSwitch({ className }: { className?: string }) {
  const { lang, setLang } = useLang();
  return (
    <div role="group" aria-label="Language" translate="no" className={"inline-flex border border-border-strong text-sm " + (className ?? "")}>
      {(["en", "si"] as const).map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={lang === l}
          onClick={() => setLang(l)}
          className={"min-h-9 px-3 transition-colors " + (lang === l ? "bg-walnut font-semibold text-ivory" : "bg-surface text-text hover:bg-linen")}
        >
          {LANG_NAME[l]}
        </button>
      ))}
    </div>
  );
}
