import type { GuideItem } from "@/lib/owner-guide";

/** Words that carry no meaning in a question ("how do I add a photo" is about "add" and "photo"). */
const STOP = new Set(
  "a an the how do does did i me my we our you your to of for in on at by with from and or is are was be it its this that these those can could would should will what where when why which who whom there here if so as not no any some about into over under up out please want need get make use using put show tell".split(" "),
);

/** A word cut down to its root, so that photos, photo and photographs meet, and adding, added and add meet. */
export function stem(word: string): string {
  let w = word;
  if (w.length > 5 && w.endsWith("ies")) w = w.slice(0, -3) + "y";
  else if (w.length > 4 && w.endsWith("es")) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) w = w.slice(0, -1);
  if (w.length > 5 && w.endsWith("ing")) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith("ed")) w = w.slice(0, -2);
  if (w.length > 3 && w.endsWith("e")) w = w.slice(0, -1);
  return w;
}

/** The meaningful words of a text, as roots. */
export function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP.has(w))
    .map(stem);
}

const has = (list: string[], token: string) => list.some((w) => w === token || (token.length >= 4 && (w.startsWith(token) || token.startsWith(w) && w.length >= 4)));

export interface GuideMatch {
  item: GuideItem;
  score: number;
}

/**
 * The entries that answer a question, best first. Each word of the question is looked for in the entry's question (counts most), its keywords, its
 * section, and then the rest of its text. A word that is found nowhere counts against the entry, so an entry that covers more of the question beats
 * one that covers a single word. Only entries close to the best one are kept, and at most `limit`.
 */
export function searchGuide(query: string, items: GuideItem[], limit = 4): GuideMatch[] {
  const tokens = [...new Set(words(query))];
  if (tokens.length === 0) return [];
  const scored: GuideMatch[] = [];
  for (const item of items) {
    const q = words(item.question);
    const k = words(item.keywords);
    const s = words(item.section);
    const body = words([item.answer, ...(item.steps ?? []), ...(item.tips ?? [])].join(" "));
    let score = 0;
    let found = 0;
    for (const t of tokens) {
      let hit = 0;
      if (has(q, t)) hit = Math.max(hit, 5);
      if (has(k, t)) hit = Math.max(hit, 4);
      if (has(s, t)) hit = Math.max(hit, 2);
      if (has(body, t)) hit = Math.max(hit, 1);
      if (hit > 0) found += 1;
      score += hit;
    }
    if (found === 0) continue;
    // The more of the question's words an entry covers, the better.
    score *= found / tokens.length;
    // The whole question, or most of it, in the entry's own question.
    const joined = tokens.join(" ");
    if (q.join(" ").includes(joined)) score += 6;
    scored.push({ item, score });
  }
  scored.sort((a, b) => b.score - a.score);
  const top = scored[0]?.score ?? 0;
  return scored.filter((m) => m.score >= top * 0.5 && m.score >= 1.5).slice(0, limit);
}
