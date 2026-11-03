import { z } from "zod";

/**
 * Public env vars are inlined at build time, so they must be read with
 * literal `process.env.NAME` access (not dynamic keys).
 */
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_RAZORPAY_KEY_ID: z.string().min(1).optional(),
  NEXT_PUBLIC_DEMO_MODE: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  RAZORPAY_KEY_SECRET: z.string().min(1).optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().min(1).optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),
});

const emptyToUndefined = (v: string | undefined) => (v === "" ? undefined : v);

export const publicEnv = publicSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: emptyToUndefined(process.env.NEXT_PUBLIC_SUPABASE_URL),
  // Supabase's newer "publishable" key works the same as the anon key (the Vercel integration may set either).
  NEXT_PUBLIC_SUPABASE_ANON_KEY:
    emptyToUndefined(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ?? emptyToUndefined(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
  NEXT_PUBLIC_RAZORPAY_KEY_ID: emptyToUndefined(process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID),
  NEXT_PUBLIC_DEMO_MODE: emptyToUndefined(process.env.NEXT_PUBLIC_DEMO_MODE),
});

/** Only call from server code. Values are never sent to the browser. */
export function getServerEnv() {
  return serverSchema.parse({
    SUPABASE_SERVICE_ROLE_KEY: emptyToUndefined(process.env.SUPABASE_SERVICE_ROLE_KEY) ?? emptyToUndefined(process.env.SUPABASE_SECRET_KEY),
    RAZORPAY_KEY_SECRET: emptyToUndefined(process.env.RAZORPAY_KEY_SECRET),
    RAZORPAY_WEBHOOK_SECRET: emptyToUndefined(process.env.RAZORPAY_WEBHOOK_SECRET),
    OPENAI_API_KEY: emptyToUndefined(process.env.OPENAI_API_KEY),
  });
}

export const isDemoMode = publicEnv.NEXT_PUBLIC_DEMO_MODE;

export const isSupabaseConfigured = Boolean(
  publicEnv.NEXT_PUBLIC_SUPABASE_URL && publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

export function requireSupabaseEnv() {
  const url = publicEnv.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (see .env.example).",
    );
  }
  return { url, anonKey };
}
