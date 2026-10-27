import { SI_PATTERNS } from "./si-patterns";
import { SI } from "./si";

/** Text as the dictionary stores it: runs of spaces and line breaks become one space, and the ends are trimmed. */
export const normalise = (s: string) => s.replace(/\s+/g, " ").trim();

/**
 * The Sinhala for an English text of the dashboard, or null when there is none (the text then stays as it is: names, numbers, anything the
 * dictionary does not hold). First the exact text is looked up, then the patterns for texts with a number or a name inside them.
 */
export function toSinhala(text: string): string | null {
  const t = normalise(text);
  if (t === "") return null;
  const exact = SI[t];
  if (exact !== undefined) return exact;
  for (const [re, make] of SI_PATTERNS) {
    const m = re.exec(t);
    if (m) {
      const out = make(m);
      if (out) return out;
    }
  }
  return null;
}
