'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BookOpen,
  UploadCloud,
  LayoutDashboard,
  Settings,
  Plus,
  ChevronDown,
  Trash2,
  Check,
  Menu,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import { AddKitchenModal } from '@/components/domain/AddKitchenModal';
import { LogoutButton } from '@/components/domain/LogoutButton';

export interface SidebarKitchenMeta {
  id: string;
  code: string;
  name: string;
  bankCode?: string;
  accountNoLast4?: string;
  periodLabel?: string;
}

interface SidebarProps {
  kitchens: readonly SidebarKitchenMeta[];
  userEmail?: string;
}

export function Sidebar({ kitchens, userEmail = 'Maker Keuangan' }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  // Deteksi active kitchen dari path /k/[kitchenId]/...
  const match = pathname.match(/\/k\/([^/]+)/);
  const activeKitchenId = match ? match[1] : kitchens[0]?.id;
  const activeKitchen = kitchens.find((k) => k.id === activeKitchenId) || kitchens[0];

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const hasDemo = kitchens.some(
    (k) => k.code.startsWith('DS-') || k.id.startsWith('10000000-0000-4000-8000-'),
  );

  async function handleClearDemo() {
    if (!confirm('Apakah Anda yakin ingin menghapus data demo sintetis? Ini akan menyisakan ruang bersih untuk dapur asli Anda.')) {
      return;
    }
    setIsClearing(true);
    try {
      await fetch('/api/kitchens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear_demo' }),
      });
      setIsClearing(false);
      setIsDropdownOpen(false);
      router.refresh();
      // Buka modal tambah dapur agar pengguna langsung mengisi dapur nyata
      setIsModalOpen(true);
    } catch {
      setIsClearing(false);
    }
  }

  const navItems = [
    {
      label: 'Buku Kas (Ledger)',
      href: activeKitchen ? `/k/${activeKitchen.id}/ledger` : '/dashboard',
      icon: BookOpen,
      isActive: pathname.includes('/ledger'),
    },
    {
      label: 'Unggah Bukti Transfer',
      href: activeKitchen ? `/k/${activeKitchen.id}/review` : '/dashboard',
      icon: UploadCloud,
      isActive: pathname.includes('/review'),
    },
    {
      label: 'Ringkasan Dapur',
      href: '/dashboard?view=summary',
      icon: LayoutDashboard,
      isActive: pathname === '/dashboard',
    },
    {
      label: 'Pengaturan Dapur',
      href: activeKitchen ? `/k/${activeKitchen.id}/settings` : '/dashboard',
      icon: Settings,
      isActive: pathname.includes('/settings'),
    },
  ];

  return (
    <>
      {/* Mobile Bar (<= 1024px) */}
      <div className="lg:hidden sticky top-0 z-40 flex h-14 w-full shrink-0 items-center justify-between border-b border-[var(--line)] bg-[var(--surface)] px-4">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsMobileOpen(!isMobileOpen)}
            className="p-1.5 rounded-md text-[var(--ink-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--ink)]"
          >
            {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--accent)] text-white">
              <FileSpreadsheet className="h-4 w-4" />
            </div>
            <span className="font-semibold text-sm tracking-tight text-[var(--ink)]">Kasdapur</span>
          </div>
        </div>

        {activeKitchen && (
          <span className="text-xs font-medium text-[var(--accent)] bg-[var(--accent-subtle)] px-2.5 py-1 rounded-full">
            {activeKitchen.code}
          </span>
        )}
      </div>

      {/* Backdrop Mobile Drawer */}
      {isMobileOpen && (
        <div
          onClick={() => setIsMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs lg:hidden"
        />
      )}

      {/* Sidebar Panel (Linear / Stripe Style: 256px Fixed) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col border-r border-[var(--line)] bg-[var(--surface)] transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* 1. Header Logo & Brand */}
        <div className="flex h-14 items-center justify-between border-b border-[var(--line)] px-4">
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent)] text-white shadow-xs group-hover:bg-[var(--accent-hover)] transition-colors">
              <FileSpreadsheet className="h-4.5 w-4.5" />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-sm font-semibold tracking-tight text-[var(--ink)] leading-tight">
                Kasdapur
              </span>
              <span className="text-[10px] text-[var(--ink-muted)] font-medium">
                Pembukuan Buku Kas
              </span>
            </div>
          </Link>
        </div>

        {/* 2. Kitchen Selector Dropdown */}
        <div className="p-3 border-b border-[var(--line)] relative">
          <div className="text-[10px] font-semibold tracking-wider text-[var(--ink-subtle)] uppercase px-1 mb-1.5">
            Dapur Aktif
          </div>

          <button
            type="button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex w-full items-center justify-between rounded-lg border border-[var(--line-strong)] bg-[var(--surface-muted)] p-2 text-left hover:border-[var(--accent-line)] hover:bg-[var(--surface)] transition-all"
          >
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--accent-subtle)] text-[var(--accent)] font-semibold text-xs">
                {activeKitchen ? activeKitchen.code.slice(0, 2) : 'DP'}
              </div>
              <div className="truncate">
                <div className="text-xs font-semibold text-[var(--ink)] truncate">
                  {activeKitchen ? activeKitchen.name : 'Pilih Dapur'}
                </div>
                <div className="text-[10px] text-[var(--ink-muted)] truncate">
                  {activeKitchen ? `${activeKitchen.code} • ${activeKitchen.bankCode || 'Bank'}` : 'Belum ada dapur'}
                </div>
              </div>
            </div>
            <ChevronDown className="h-4 w-4 shrink-0 text-[var(--ink-muted)]" />
          </button>

          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <div className="absolute left-3 right-3 top-[76px] z-50 rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-xl p-1.5 space-y-1">
              <div className="max-h-48 overflow-y-auto space-y-0.5">
                {kitchens.map((k) => {
                  const isSelected = activeKitchen?.id === k.id;
                  return (
                    <button
                      key={k.id}
                      type="button"
                      onClick={() => {
                        setIsDropdownOpen(false);
                        setIsMobileOpen(false);
                        router.push(`/k/${k.id}/ledger`);
                      }}
                      className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-xs text-left transition-colors ${
                        isSelected
                          ? 'bg-[var(--accent-subtle)] text-[var(--accent)] font-semibold'
                          : 'text-[var(--ink)] hover:bg-[var(--surface-muted)]'
                      }`}
                    >
                      <div className="truncate">
                        <div className="truncate font-medium">{k.name}</div>
                        <div className="text-[10px] text-[var(--ink-muted)]">{k.code}</div>
                      </div>
                      {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />}
                    </button>
                  );
                })}
              </div>

              <div className="border-t border-[var(--line)] pt-1 space-y-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsDropdownOpen(false);
                    setIsModalOpen(true);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-semibold text-[var(--accent)] hover:bg-[var(--accent-subtle)] transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Tambah Dapur Baru</span>
                </button>

                {hasDemo && (
                  <button
                    type="button"
                    disabled={isClearing}
                    onClick={handleClearDemo}
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium text-[var(--danger)] hover:bg-[var(--danger-subtle)] transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>{isClearing ? 'Membersihkan...' : 'Bersihkan Data Demo'}</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 3. Navigation Links */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <div className="text-[10px] font-semibold tracking-wider text-[var(--ink-subtle)] uppercase px-2 mb-1.5">
            Menu Utama
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setIsMobileOpen(false)}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                  item.isActive
                    ? 'bg-[var(--accent-subtle)] text-[var(--accent)] font-semibold shadow-2xs'
                    : 'text-[var(--ink)] hover:bg-[var(--surface-muted)] hover:text-[var(--ink)]'
                }`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 ${
                    item.isActive ? 'text-[var(--accent)]' : 'text-[var(--ink-muted)]'
                  }`}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* 4. Footer User Profile & Logout */}
        <div className="border-t border-[var(--line)] p-3 bg-[var(--surface-muted)]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--line)] text-xs font-semibold text-[var(--ink)]">
                {userEmail.slice(0, 1).toUpperCase()}
              </div>
              <div className="truncate">
                <div className="text-xs font-medium text-[var(--ink)] truncate">
                  {userEmail}
                </div>
                <div className="text-[10px] text-[var(--ok)] font-medium flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--ok)] inline-block" />
                  Sesi Terverifikasi
                </div>
              </div>
            </div>

            <LogoutButton />
          </div>
        </div>
      </aside>

      {/* Modal Tambah Dapur Baru */}
      <AddKitchenModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        hasDemoData={hasDemo}
      />
    </>
  );
}
