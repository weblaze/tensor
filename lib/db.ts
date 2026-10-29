import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Server-only Supabase client with the secret key. RLS has no policies, so only this key can read or write.
let client: SupabaseClient | null = null;

export function hasDb(): boolean {
  return !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SECRET_KEY;
}

export function db(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY must be set in .env.local");
  }
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

/** Throw on a Supabase error so callers can treat results as data. */
export function must<T>(res: { data: T | null; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data as T;
}

export const MEDIA_BUCKET = "site-media";

export async function signedUrls(paths: (string | null)[], seconds = 60 * 60 * 6): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter((p): p is string => !!p))];
  const out = new Map<string, string>();
  if (unique.length === 0) return out;
  const { data } = await db().storage.from(MEDIA_BUCKET).createSignedUrls(unique, seconds);
  for (const row of data ?? []) {
    if (row.path && row.signedUrl) out.set(row.path, row.signedUrl);
  }
  return out;
}
