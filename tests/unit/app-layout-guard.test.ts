import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import AppShellLayout from '@/app/(app)/layout';

// Mock requireUser
vi.mock('@/server/auth/require-user', () => ({
  requireUser: vi.fn(),
}));

import { requireUser } from '@/server/auth/require-user';

describe('SECURITY S-01: Layout Server Component Protection (F-002)', () => {
  it('AppShellLayout memanggil requireUser() dan menolak akses tanpa sesi', async () => {
    vi.mocked(requireUser).mockRejectedValueOnce(new Error('NEXT_REDIRECT: /login'));

    await expect(
      AppShellLayout({
        children: React.createElement('div', null, 'Halaman Rahasia Dapur'),
      }),
    ).rejects.toThrow('NEXT_REDIRECT: /login');

    expect(requireUser).toHaveBeenCalled();
  });

  it('AppShellLayout berhasil merender ketika requireUser() berhasil', async () => {
    vi.mocked(requireUser).mockResolvedValueOnce({
      supabase: {} as unknown as Awaited<ReturnType<typeof requireUser>>['supabase'],
      user: {
        id: '00000000-0000-4000-8000-000000000001',
        email: 'maker@sintetis.example',
      } as unknown as Awaited<ReturnType<typeof requireUser>>['user'],
    });

    const rendered = await AppShellLayout({
      children: React.createElement('div', { id: 'test-content' }, 'Konten Dapur'),
    });

    expect(rendered).toBeDefined();
    expect(requireUser).toHaveBeenCalled();
  });
});
