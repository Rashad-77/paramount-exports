/** The languages the owner dashboard can be shown in. The website itself stays in English. */
export type Lang = "en" | "si";

/** The cookie that remembers the choice (a year), so the dashboard opens in the language the owner last picked. */
export const LANG_COOKIE = "dash_lang";

export const LANG_NAME: Record<Lang, string> = { en: "English", si: "සිංහල" };

export const parseLang = (v: string | null | undefined): Lang => (v === "si" ? "si" : "en");
