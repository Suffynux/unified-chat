import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Clients are cached at module scope so warm serverless invocations reuse the
// same instance instead of opening new connections on every request.
let serverClient: SupabaseClient | null = null;
let browserClient: SupabaseClient | null = null;

/**
 * Service-role client for API routes. Bypasses RLS — never import this from
 * client components. Returns null when env vars are not configured so the
 * app still builds/runs with empty placeholder credentials.
 */
export function supabaseServer(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (!serverClient) {
    serverClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return serverClient;
}

/** Anon-key client for the browser. Subject to RLS; used by the inbox UI. */
export function supabaseBrowser(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  if (!browserClient) {
    browserClient = createClient(url, key);
  }
  return browserClient;
}
