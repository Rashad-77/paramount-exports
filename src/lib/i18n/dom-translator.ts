/** Elements whose text is never translated: code, form values, and anything marked translate="no". */
const SKIP = "script,style,noscript,textarea,input,code,pre,[translate='no'],[data-no-translate]";
/** The same, for attributes: a placeholder lives on an input, so inputs are allowed there. */
const SKIP_ATTR = "script,style,noscript,code,pre,[translate='no'],[data-no-translate]";
/** Attributes that carry words for the person (not for the page): they are translated like text. */
const ATTRS = ["placeholder", "aria-label", "title"] as const;

/**
 * Translates the words on the page as they are drawn and as they change, and puts the English back when stopped.
 *
 * - With `lang` "en" nothing is translated (only the bookkeeping runs), so this is also how the English is restored.
 * - An element that holds only text is translated as a whole (its text nodes are joined, so "Delete {n} products?" is one sentence); an element that
 *   mixes text and other elements is translated text node by text node.
 * - Words that React later changes (a count, a status) are noticed and translated again; words this function wrote itself are not mistaken for English.
 * - `translate(english)` returns the translation, or null to leave the words as they are.
 *
 * Returns a function that stops the translator and restores the English.
 */
export function startTranslator(root: HTMLElement, lang: "en" | "si", translate: (english: string) => string | null): () => void {
  /** The English each text node had, and what this translator last wrote into it. */
  const original = new WeakMap<Text, string>();
  const written = new WeakMap<Text, string>();
  const originalAttr = new WeakMap<Element, Record<string, string>>();
  const writtenAttr = new WeakMap<Element, Record<string, string>>();
  const si = lang === "si";

  /** A text node's English: the value React gave it, unless the value is the one this translator wrote. */
  const english = (t: Text) => {
    const w = written.get(t);
    if (w !== undefined && t.nodeValue === w) return original.get(t) ?? w;
    const now = t.nodeValue ?? "";
    original.set(t, now);
    written.delete(t);
    return now;
  };
  const put = (t: Text, value: string) => {
    if (t.nodeValue === value) return;
    t.nodeValue = value;
    written.set(t, value);
  };
  const restore = (t: Text) => {
    const w = written.get(t);
    if (w !== undefined && t.nodeValue === w) t.nodeValue = original.get(t) ?? w;
    written.delete(t);
  };

  /** Translates the words directly inside one element. */
  const doElement = (el: Element) => {
    if (el.closest(SKIP)) return;
    const nodes = Array.from(el.childNodes);
    const texts = nodes.filter((n): n is Text => n.nodeType === Node.TEXT_NODE);
    if (texts.length === 0) return;
    const groups: Text[][] = texts.length === nodes.length ? [texts] : texts.map((t) => [t]);
    for (const g of groups) {
      const eng = g.map(english);
      const joined = eng.join("");
      const out = si ? translate(joined) : null;
      if (out === null) {
        g.forEach((t) => {
          if (written.has(t)) restore(t);
        });
        continue;
      }
      // Keep the spaces that stood at the two ends of the English.
      const lead = /^\s/.test(joined) ? " " : "";
      const tail = /\s$/.test(joined) ? " " : "";
      const first = eng.findIndex((e) => e.trim() !== "");
      g.forEach((t, i) => put(t, i === first ? lead + out + tail : ""));
    }
  };

  const doAttrs = (el: Element) => {
    if (el.closest(SKIP_ATTR)) return;
    for (const a of ATTRS) {
      const cur = el.getAttribute(a);
      if (cur === null) continue;
      const wr = writtenAttr.get(el)?.[a];
      const ours = wr !== undefined && cur === wr;
      const eng = ours ? (originalAttr.get(el)?.[a] ?? cur) : cur;
      if (!ours) originalAttr.set(el, { ...(originalAttr.get(el) ?? {}), [a]: cur });
      const next = (si ? translate(eng) : null) ?? eng;
      if (next !== cur) {
        el.setAttribute(a, next);
        writtenAttr.set(el, { ...(writtenAttr.get(el) ?? {}), [a]: next });
      } else if (!ours && wr !== undefined) {
        const w = { ...(writtenAttr.get(el) ?? {}) };
        delete w[a];
        writtenAttr.set(el, w);
      }
    }
  };

  const walk = (start: Node) => {
    if (start.nodeType === Node.TEXT_NODE) {
      if (start.parentElement) doElement(start.parentElement);
      return;
    }
    if (start.nodeType !== Node.ELEMENT_NODE) return;
    const el = start as Element;
    doElement(el);
    doAttrs(el);
    el.querySelectorAll("*").forEach((c) => {
      doElement(c);
      doAttrs(c);
    });
  };

  const observer = new MutationObserver((records) => {
    observer.disconnect();
    for (const r of records) {
      if (r.type === "characterData") {
        const t = r.target as Text;
        // Our own writes come back as records: skip them.
        if (written.get(t) === t.nodeValue) continue;
        if (t.parentElement) doElement(t.parentElement);
      } else if (r.type === "attributes") {
        doAttrs(r.target as Element);
      } else {
        r.addedNodes.forEach(walk);
        if (r.target.nodeType === Node.ELEMENT_NODE) doElement(r.target as Element);
      }
    }
    observer.takeRecords();
    observe();
  });
  const observe = () => observer.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: [...ATTRS] });

  walk(root);
  observer.takeRecords();
  observe();

  return () => {
    observer.disconnect();
    // Put the English back, so the next language starts from the original words.
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) restore(n as Text);
    root.querySelectorAll("[placeholder],[aria-label],[title]").forEach((el) => {
      const w = writtenAttr.get(el);
      const o = originalAttr.get(el);
      if (!w || !o) return;
      for (const a of Object.keys(w)) if (el.getAttribute(a) === w[a] && o[a] !== undefined) el.setAttribute(a, o[a]!);
    });
  };
}
