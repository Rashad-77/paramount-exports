import { revalidateTag } from "next/cache";

/** Everything the public catalogue reads from the database (the collection list, the categories, the materials, the premium range). */
export const CATALOGUE_TAG = "catalogue";

/** Seconds a saved catalogue read is reused when nothing clears it sooner. */
export const CATALOGUE_REVALIDATE = 300;

/**
 * Throws away the saved catalogue reads, so the next visitor gets fresh ones. Call it from anything that changes what the public sees:
 * products, categories, stock (orders). `expire: 0` means the next request waits for fresh data instead of being shown the old copy.
 */
export const clearCatalogueCache = () => revalidateTag(CATALOGUE_TAG, { expire: 0 });
