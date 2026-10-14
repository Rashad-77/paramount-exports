export interface Milestone {
  /** A year or short date: "2009", "Spring 2015". */
  when: string;
  title: string;
  body: string | null;
}

/** Most milestones shown on the About page. */
export const MAX_MILESTONES = 12;

/**
 * The history is kept as plain text in Website content: one milestone per blank-line-separated block. First line the year (or date),
 * second line the heading, any lines after that the story. Nothing is invented: with no text the page shows a clearly labelled outline.
 */
export function parseHistory(text: string | null | undefined): Milestone[] {
  if (!text) return [];
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((block) => block.split("\n").map((l) => l.trim()).filter(Boolean))
    .filter((lines) => lines.length >= 2)
    .slice(0, MAX_MILESTONES)
    .map(([when, title, ...rest]) => ({ when: when!, title: title!, body: rest.join(" ") || null }));
}

/** Shown, labelled as a draft, until the business writes its own history. */
export const SAMPLE_HISTORY: Milestone[] = [
  { when: "Year", title: "How it began", body: "Tell the story of how the workshop started and who started it." },
  { when: "Year", title: "Growing the workshop", body: "The first big order, the move to a larger space, the people who joined." },
  { when: "Year", title: "Opening the showroom", body: "When customers could first walk in and see the timber and the finish for themselves." },
  { when: "Today", title: "Where we are now", body: "What the business makes today, and what it is working towards." },
];
