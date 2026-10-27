import { SI_CATALOGUE } from "./si-catalogue";
import { SI_COMMON } from "./si-common";
import { SI_SALES } from "./si-sales";
import { SI_SETTINGS } from "./si-settings";

/** Every English text of the dashboard that has a Sinhala translation (the key is the English as shown). */
export const SI: Record<string, string> = { ...SI_COMMON, ...SI_CATALOGUE, ...SI_SALES, ...SI_SETTINGS };
