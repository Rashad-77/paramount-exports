/**
 * How much a premium piece's description may say. On the premium page the words sit beside the photograph and stop where the photograph
 * ends: on a computer screen about 1500 px wide, 160 words (about 12 words to a line, 14 lines) fill the space from the title to the button
 * at the bottom of the photograph. Narrower screens have less room, and there the end of the text fades out where the photograph ends.
 */
export const PREMIUM_MAX_WORDS = 160;

/** Words in a text: runs of letters, digits and punctuation separated by spaces or line breaks. */
export const countWords = (text: string | null | undefined): number => (text?.trim() ? text.trim().split(/\s+/).length : 0);
