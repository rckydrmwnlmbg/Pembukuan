import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getEnv } from '@/server/env';

/**
 * Membuat klien Supabase server yang meneruskan identitas pengguna (JWT)
 * sehingga seluruh kebijakan RLS berlaku penuh (TECH-STACK.md Bagian 3 & SECURITY.md S-01).
 */
export async function createClient() {
  const cookieStore = await cookies();
  const env = getEnv();

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, {
                ...options,
                httpOnly: true,
                sameSite: 'lax',
                secure: env.APP_ENV === 'production',
                path: '/',
              });
            }
          } catch {
            // Dipanggil dari Server Component baca-saja; penyegaran cookie ditangani di middleware.ts
          }
        },
      },
    },
  );
}
