import { NextResponse } from 'next/server';
import { createClient } from '@/server/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Route handler untuk menerima redirect callback dari Supabase Auth
 * (misalnya konfirmasi email, magic link, atau reset password).
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const origin = requestUrl.origin;

  if (code) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return NextResponse.redirect(`${origin}/dashboard`);
      }
    } catch {
      // Abaikan dan alihkan ke login
    }
  }

  // Jika kode verifikasi berhasil atau dialihkan kembali
  return NextResponse.redirect(`${origin}/login?confirmed=true`);
}
