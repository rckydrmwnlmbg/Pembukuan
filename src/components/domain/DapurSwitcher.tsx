'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/Badge';

export interface DapurSwitcherOption {
  id: string;
  code: string;
  name: string;
  periodLabel: string;
  periodStatus: 'open' | 'locked';
}

export interface DapurSwitcherProps {
  activeKitchenId: string;
  kitchens: readonly DapurSwitcherOption[];
}

/**
 * Pengalih dapur di bilah atas (`DESIGN.md` §5.1).
 * Menegakkan aturan emas #1: tidak pernah menampilkan atau menjumlahkan saldo lintas dapur.
 * Ketika pengguna berpindah dapur, halaman tetap berada pada modul yang sama untuk dapur baru.
 */
export function DapurSwitcher({
  activeKitchenId,
  kitchens,
}: DapurSwitcherProps) {
  const router = useRouter();
  const activeKitchen =
    kitchens.find((k) => k.id === activeKitchenId) ?? kitchens[0];

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const nextKitchenId = event.target.value;
    if (nextKitchenId && nextKitchenId !== activeKitchenId) {
      router.push(`/k/${nextKitchenId}/ledger`);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <span
          className="h-2 w-2 rounded-full bg-accent-primary"
          aria-hidden="true"
        />
        <label htmlFor="dapur-switcher-select" className="sr-only">
          Pilih dapur aktif
        </label>
        <select
          id="dapur-switcher-select"
          value={activeKitchen?.id ?? activeKitchenId}
          onChange={handleChange}
          aria-label="Pilih dapur aktif"
          className="h-9 rounded-md border border-line-strong bg-surface px-3 text-sm font-medium text-ink-primary transition-colors hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
        >
          {kitchens.map((k) => (
            <option key={k.id} value={k.id}>
              {k.name} ({k.code})
            </option>
          ))}
        </select>
      </div>
      {activeKitchen ? (
        <div className="hidden items-center gap-2 sm:flex">
          <span className="text-xs text-ink-secondary">
            Periode {activeKitchen.periodLabel}
          </span>
          <Badge
            tone={
              activeKitchen.periodStatus === 'locked' ? 'neutral' : 'accent'
            }
          >
            {activeKitchen.periodStatus === 'locked' ? 'Terkunci' : 'Terbuka'}
          </Badge>
        </div>
      ) : null}
    </div>
  );
}
