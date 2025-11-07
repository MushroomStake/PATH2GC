import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Lazily create a Supabase admin client using the service role key.
 * Avoid creating the client at module-eval time so builds (e.g. Vercel)
 * don't fail when environment variables aren't yet configured.
 */
export function getSupabaseAdmin(): SupabaseClient {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
  const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE as string | undefined;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    // Throw a clear error so the Vercel build log shows what to set.
    throw new Error(
      'Missing Supabase server env vars. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE in your environment (e.g. Vercel project settings).'
    );
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
}
