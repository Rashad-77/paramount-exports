/**
 * How much a premium piece's description may say. On the premium page the words sit beside the photograph and stop where the photograph
 * ends, so the description is kept short enough to fit there on a computer screen (a little under 10 words to a line, about 10 lines).
 */
export const PREMIUM_MAX_WORDS = 90;

/** Words in a text: runs of letters, digits and punctuation separated by spaces or line breaks. */
export const countWords = (text: string | null | undefined): number => (text?.trim() ? text.trim().split(/\s+/).length : 0);
