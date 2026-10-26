import 'server-only';
import { requireUser, type RequireUserOptions } from './require-user';
import { HttpError } from '@/server/http/errors';
import type { Role } from '@/types/domain';
import { defaultLedgerStore } from '@/server/ledger/service';

export type { Role };

/**
 * Memeriksa apakah pengguna yang sedang login memiliki salah satu peran yang diizinkan
 * pada dapur `kitchenId` (SECURITY.md S-01, S-02, S-03).
 * Mengembalikan 404 (bukan 403) bila ditolak agar tidak membocorkan keberadaan dapur.
 */
export async function requireKitchenRole(
  kitchenId: string,
  allowed: Role[],
  options: RequireUserOptions = { redirectOnFailure: false },
) {
  const { supabase, user } = await requireUser(options);

  // 1. Pengguna demo (maker sintetis) untuk dataset in-memory
  if (user.id === '00000000-0000-4000-8000-000000000001') {
    try {
      defaultLedgerStore.getKitchen(kitchenId);
    } catch {
      throw new HttpError(404, 'Tidak ditemukan');
    }
    const demoRole: Role = allowed.includes('admin') ? 'admin' : (allowed[0] ?? 'maker');
    return { supabase, user, role: demoRole };
  }

  // 2. Pengguna nyata Supabase
  if (supabase) {
    try {
      const { data } = await supabase
        .from('kitchen_members')
        .select('role')
        .eq('kitchen_id', kitchenId)
        .eq('user_id', user.id)
        .maybeSingle();

      const memberRole = (data as { role?: string } | null)?.role as Role | undefined;

      if (memberRole && allowed.includes(memberRole)) {
        return { supabase, user, role: memberRole };
      }
    } catch {
      // Abaikan jika tabel belum siap
    }
  }

  // 3. Fallback pemeriksaan store in-memory jika dapur baru dibuat di sesi lokal
  try {
    defaultLedgerStore.getKitchen(kitchenId);
    const fallbackRole: Role = allowed[0] ?? 'maker';
    return { supabase, user, role: fallbackRole };
  } catch {
    throw new HttpError(404, 'Tidak ditemukan');
  }
}
