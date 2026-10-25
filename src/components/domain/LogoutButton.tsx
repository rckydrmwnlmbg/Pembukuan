'use client';

import React, { useState } from 'react';
import { clearSessionAction } from '@/server/auth/actions';

export function LogoutButton() {
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      await clearSessionAction();
    } catch {
      // Abaikan bila ada galat jaringan
    }
    document.cookie = 'kasdapur_session=; path=/; max-age=0';
    window.location.href = '/login';
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className="text-xs text-[var(--ink-muted)] hover:text-[var(--ink)] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)] rounded px-2 py-1 border border-[var(--line-subtle)] hover:bg-[var(--surface-muted)]"
      title="Keluar dari sesi ini"
    >
      {loading ? 'Keluar...' : 'Keluar'}
    </button>
  );
}
