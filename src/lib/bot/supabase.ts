import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";

let cached: SupabaseClient | null = null;

/**
 * Server-only admin client (service role). Never expose to the browser.
 */
export function supabaseAdmin(): SupabaseClient {
  if (cached) return cached;
  cached = createClient(env.supabaseUrl(), env.supabaseServiceKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
