import { revalidateTag } from "next/cache";

/** The business details, page text and account switches, read on almost every page. */
export const SETTINGS_TAG = "settings";
/** Seconds a saved read is reused when nothing clears it sooner. */
export const SETTINGS_REVALIDATE = 300;

/** Call after settings are saved, so the next visitor gets the new ones. */
export const clearSettingsCache = () => revalidateTag(SETTINGS_TAG, { expire: 0 });
