import React from 'react';
import { requireUser } from '@/server/auth/require-user';
import { defaultLedgerStore } from '@/server/ledger/service';
import { listUserKitchens } from '@/server/ledger/supabase-ledger';
import { formatPeriodLabel } from '@/lib/format';
import { Sidebar, type SidebarKitchenMeta } from '@/components/domain/Sidebar';

export const dynamic = 'force-dynamic';

/**
 * AppShellLayout untuk seluruh layar pembukuan internal:
 * Mengambil data dapur riil milik pengguna dari database Supabase (atau fallback in-memory jika mode pengujian).
 */
export default async function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, supabase } = await requireUser();

  let serializedKitchens: SidebarKitchenMeta[] = [];

  // 1. Coba ambil dari database Supabase pengguna nyata
  if (supabase && user.id !== '00000000-0000-4000-8000-000000000001') {
    try {
      const realKitchens = await listUserKitchens(supabase, user.id);
      serializedKitchens = realKitchens.map((k) => ({
        id: k.id,
        code: k.code,
        name: k.name,
        bankCode: k.bankCode,
        accountNoLast4: k.accountNoLast4,
        periodLabel: formatPeriodLabel(k.year, k.month),
      }));
    } catch {
      serializedKitchens = [];
    }
  }

  // 2. Fallback untuk sesi demo testing saja
  if (serializedKitchens.length === 0 && user.id === '00000000-0000-4000-8000-000000000001') {
    const allKitchens = defaultLedgerStore.listKitchenMeta();
    serializedKitchens = allKitchens.map((k) => ({
      id: k.id,
      code: k.code,
      name: k.name,
      bankCode: k.bankCode,
      accountNoLast4: k.accountNoLast4,
      periodLabel: formatPeriodLabel(k.year, k.month),
    }));
  }

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
      {/* Sidebar Navigasi Tetap di Kiri (Linear / Stripe Style) */}
      <Sidebar
        kitchens={serializedKitchens}
        userEmail={user?.email || 'Staf Keuangan'}
      />

      {/* Area Konten Utama */}
      <main className="flex flex-1 flex-col min-w-0 overflow-y-auto">
        <div className="w-full max-w-[1440px] mx-auto p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
