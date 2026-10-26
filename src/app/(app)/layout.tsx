import React from 'react';
import { requireUser } from '@/server/auth/require-user';
import { defaultLedgerStore } from '@/server/ledger/service';
import { formatPeriodLabel } from '@/lib/format';
import { Sidebar, type SidebarKitchenMeta } from '@/components/domain/Sidebar';

export const dynamic = 'force-dynamic';

/**
 * AppShellLayout untuk seluruh layar pembukuan internal:
 * Sidebar navigasi vertikal di kiri (Linear/Stripe style) + Area kerja utama.
 */
export default async function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requireUser();

  const allKitchens = defaultLedgerStore.listKitchenMeta();
  const serializedKitchens: SidebarKitchenMeta[] = allKitchens.map((k) => ({
    id: k.id,
    code: k.code,
    name: k.name,
    bankCode: k.bankCode,
    accountNoLast4: k.accountNoLast4,
    periodLabel: formatPeriodLabel(k.year, k.month),
  }));

  return (
    <div className="flex min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
      {/* Sidebar Navigasi Tetap di Kiri (Linear / Stripe Style) */}
      <Sidebar
        kitchens={serializedKitchens}
        userEmail={user?.email || 'Maker Keuangan'}
      />

      {/* Area Konten Utama */}
      <div className="flex flex-1 flex-col min-w-0 overflow-y-auto">
        <div className="w-full max-w-[1440px] mx-auto p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
