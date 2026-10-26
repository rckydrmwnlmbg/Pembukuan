import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getEnv } from '@/server/env';

/**
 * Klien Supabase dengan kunci service-role (sangat terbatas — TECH-STACK.md §3).
 * Hanya dipakai untuk bootstrap organisasi/pengguna baru saat belum memiliki keanggotaan dapur,
 * atau verifikasi status tabel database.
 */
export function createAdminClient() {
  const env = getEnv();
  return createSupabaseClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
