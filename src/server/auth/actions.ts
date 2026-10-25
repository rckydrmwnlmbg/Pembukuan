'use server';

import { cookies } from 'next/headers';

/**
 * Server action untuk mengaktifkan sesi login demo di lingkungan browser.
 * Menyetel cookie 'kasdapur_session' melalui header Set-Cookie HTTP response resmi.
 */
export async function setDemoSessionAction(): Promise<{ ok: boolean }> {
  const cookieStore = await cookies();
  cookieStore.set('kasdapur_session', 'authenticated', {
    path: '/',
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 12, // 12 jam (PRD F1.4)
  });
  return { ok: true };
}

/**
 * Server action untuk menghapus sesi dan keluar (logout).
 */
export async function clearSessionAction(): Promise<{ ok: boolean }> {
  const cookieStore = await cookies();
  cookieStore.delete('kasdapur_session');
  return { ok: true };
}
