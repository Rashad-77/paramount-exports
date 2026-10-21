import { z } from "zod";

/**
 * Environment access. Validation is lazy (on first read) so that `next build`
 * and the public site still work in environments where the database is not
 * configured yet. Server-only values must never be read from client code.
 */

const booleanString = z
  .enum(["true", "false"])
  .default("false")
  .transform((v) => v === "true");

const serverSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DATABASE_DIRECT_URL: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  IP_HASH_SALT: z.string().min(16, "IP_HASH_SALT must be at least 16 characters").optional(),
  CRON_SECRET: z.string().min(16).optional(),
  TURNSTILE_SECRET_KEY: z.string().min(1).optional(),
  /** Sends the owner an email when an order or message arrives (Resend). Without it, nothing is sent. */
  RESEND_API_KEY: z.string().min(1).optional(),
  /** Google Places API key, used to show the business's Google reviews on the website. Without it no Google reviews are shown. */
  GOOGLE_PLACES_API_KEY: z.string().min(10).optional(),
  /** Where the Places API lives. Only set for tests, to point at a stand-in; Google's address is used when blank. */
  GOOGLE_PLACES_API_URL: z.string().url().optional(),
  /** The "from" address for those emails, e.g. "Paramount website <orders@yourdomain.lk>". Must be on a domain verified with Resend. */
  MAIL_FROM: z.string().min(3).optional(),
  DEMO_MODE: booleanString,
  /** "local" stores uploads on disk and is refused in production. Default: Supabase Storage. */
  STORAGE_DRIVER: z.enum(["supabase", "local"]).default("supabase"),
});

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1).optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;
export type PublicEnv = z.infer<typeof publicSchema>;

let serverCache: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  if (typeof window !== "undefined") {
    throw new Error("serverEnv() must not be called in the browser");
  }
  if (!serverCache) {
    const parsed = serverSchema.safeParse(process.env);
    if (!parsed.success) {
      // Report variable names only — never values.
      const names = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
      throw new Error(`Invalid or missing server environment variables: ${names}`);
    }
    serverCache = parsed.data;
  }
  return serverCache;
}

/** True when a database connection string is configured. */
export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/** Public values are inlined by Next at build time, so reference them explicitly. */
export function publicEnv(): PublicEnv {
  return publicSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || undefined,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || undefined,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || undefined,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || undefined,
  });
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/** Demo/sample data may only be created outside production AND when explicitly enabled. */
export function demoModeEnabled(): boolean {
  return !isProduction() && process.env.DEMO_MODE === "true";
}
