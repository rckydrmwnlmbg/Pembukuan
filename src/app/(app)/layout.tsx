import React from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { requireUser } from '@/server/auth/require-user';

/**
 * AppShellLayout untuk seluruh halaman terlindungi di bawah `(app)`:
 * Wajib memanggil requireUser() untuk menegakkan otorisasi sesi & MFA AAL2 (SECURITY.md S-01).
 * Halaman publik hanya `/`, `/login`, dan callback auth.
 */
export default async function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();

  return (
    <div className="min-h-screen bg-canvas text-ink-primary">
      {/* Bilah atas 56px (DESIGN.md §4) */}
      <header className="sticky top-0 z-30 h-14 border-b border-line-subtle bg-surface px-4 sm:px-6">
        <div className="mx-auto flex h-full max-w-[1440px] items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-base font-semibold tracking-tight text-ink-primary focus-visible:outline-2 focus-visible:outline-focus-ring"
            >
              Kasdapur
            </Link>
            <span className="hidden text-xs text-ink-muted md:inline">
              Pembukuan Buku Kas per Dapur (SPPG)
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <Badge tone="warning" title="Seluruh data di lingkungan ini adalah data sintetis">
              Data contoh
            </Badge>
            <Badge tone="accent">MFA AAL2 Aktif</Badge>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6">
        {children}
      </div>
    </div>
  );
}
