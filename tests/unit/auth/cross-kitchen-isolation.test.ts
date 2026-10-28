import { describe, expect, it, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { kitchenRoute } from '@/server/http/kitchen-route';
import { requireKitchenRole } from '@/server/auth/require-kitchen-role';
import { HttpError } from '@/server/http/errors';

// Mock Supabase server client
vi.mock('@/server/supabase/server', () => ({
  createClient: vi.fn(),
}));

// Mock Next.js redirect
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    const err = new Error(`NEXT_REDIRECT: ${url}`);
    (err as unknown as { digest: string }).digest = `NEXT_REDIRECT;replace;${url};307;;`;
    throw err;
  }),
}));

import { createClient } from '@/server/supabase/server';

describe('TUGAS 6 — Uji Isolasi Lintas Dapur (AGENTS.md #1 & SECURITY S-01, S-02, S-03)', () => {
  const USER_A_ID = '11111111-1111-4111-8111-111111111111';
  const KITCHEN_A_ID = 'aaaaaaaa-0001-4001-8001-000000000001';
  const KITCHEN_B_ID = 'bbbbbbbb-0002-4002-8002-000000000002';

  function setupMockSupabase(params: {
    userId?: string | null;
    aal?: 'aal1' | 'aal2';
    memberships?: Record<string, string>; // kitchenId -> role
  }) {
    const { userId = USER_A_ID, aal = 'aal2', memberships = {} } = params;

    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: userId ? { user: { id: userId, email: `${userId}@sintetis.example` } } : { user: null },
          error: userId ? null : new Error('No session'),
        }),
        mfa: {
          getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({
            data: userId
              ? {
                  currentLevel: aal,
                  nextLevel: aal === 'aal2' ? 'aal2' : 'aal2',
                  currentAuthenticationMethods: aal === 'aal2' ? ['password', 'totp'] : ['password'],
                }
              : null,
          }),
        },
      },
      from: vi.fn((table: string) => {
        if (table === 'kitchen_members') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockImplementation(function (this: unknown, col: string, val: string) {
              if (col === 'kitchen_id') {
                (this as { _kitchenId: string })._kitchenId = val;
              } else if (col === 'user_id') {
                (this as { _userId: string })._userId = val;
              }
              return this;
            }),
            maybeSingle: vi.fn().mockImplementation(function (this: { _kitchenId?: string; _userId?: string }) {
              const kId = this?._kitchenId;
              const role = kId ? memberships[kId] : undefined;
              return Promise.resolve({
                data: role ? { role } : null,
                error: null,
              });
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }),
    };

    vi.mocked(createClient).mockResolvedValue(
      mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>,
    );

    return mockSupabase;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requireKitchenRole melempar HttpError 404 saat pengguna Dapur A mencoba mengakses Dapur B', async () => {
    // User A hanya memiliki peran 'maker' di Dapur A
    setupMockSupabase({
      userId: USER_A_ID,
      aal: 'aal2',
      memberships: {
        [KITCHEN_A_ID]: 'maker',
      },
    });

    // Percobaan akses ke Dapur B wajib menghasilkan 404
    await expect(
      requireKitchenRole(KITCHEN_B_ID, ['admin', 'maker', 'viewer']),
    ).rejects.toThrow(HttpError);

    try {
      await requireKitchenRole(KITCHEN_B_ID, ['admin', 'maker', 'viewer']);
    } catch (err) {
      expect((err as HttpError).status).toBe(404);
      expect((err as HttpError).publicMessage).toBe('Tidak ditemukan');
    }
  });

  it('kitchenRoute menolak panggilan Route Handler ke Dapur B dengan HTTP 404 (IDOR Protection)', async () => {
    setupMockSupabase({
      userId: USER_A_ID,
      aal: 'aal2',
      memberships: {
        [KITCHEN_A_ID]: 'maker',
      },
    });

    const route = kitchenRoute(
      ['admin', 'maker'],
      z.object({ amount: z.number() }),
      async () => Response.json({ success: true }),
    );

    // Kirim request ke endpoint Dapur B
    const req = new Request(`http://localhost:3000/api/k/${KITCHEN_B_ID}/transactions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
      },
      body: JSON.stringify({ amount: 500000 }),
    });

    const res = await route(req, {
      params: Promise.resolve({ kitchenId: KITCHEN_B_ID }),
    });

    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('Tidak ditemukan');
  });

  it('kitchenRoute mengizinkan akses jika pengguna adalah anggota sah dengan peran yang diizinkan di dapur terkait', async () => {
    setupMockSupabase({
      userId: USER_A_ID,
      aal: 'aal2',
      memberships: {
        [KITCHEN_A_ID]: 'maker',
      },
    });

    const route = kitchenRoute(
      ['admin', 'maker'],
      z.object({ description: z.string() }),
      async ({ kitchenId, role }) => Response.json({ ok: true, kitchenId, role }),
    );

    const req = new Request(`http://localhost:3000/api/k/${KITCHEN_A_ID}/transactions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
      },
      body: JSON.stringify({ description: 'Belanja sayur' }),
    });

    const res = await route(req, {
      params: Promise.resolve({ kitchenId: KITCHEN_A_ID }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; kitchenId: string; role: string };
    expect(body.ok).toBe(true);
    expect(body.kitchenId).toBe(KITCHEN_A_ID);
    expect(body.role).toBe('maker');
  });

  it('kitchenRoute menolak peran viewer saat mencoba memanggil route mutasi (POST/PUT/DELETE)', async () => {
    setupMockSupabase({
      userId: USER_A_ID,
      aal: 'aal2',
      memberships: {
        [KITCHEN_A_ID]: 'viewer', // Viewer di Dapur A
      },
    });

    const writeRoute = kitchenRoute(
      ['admin', 'maker'], // Hanya admin dan maker
      z.object({ description: z.string() }),
      async () => Response.json({ ok: true }),
    );

    const req = new Request(`http://localhost:3000/api/k/${KITCHEN_A_ID}/transactions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
      },
      body: JSON.stringify({ description: 'Coba tulis viewer' }),
    });

    const res = await writeRoute(req, {
      params: Promise.resolve({ kitchenId: KITCHEN_A_ID }),
    });

    // Menolak dengan 404 (tidak ditemukan / tidak berhak pada peran ini)
    expect(res.status).toBe(404);
  });

  it('kitchenRoute menolak sesi yang belum AAL2 dengan HTTP 403', async () => {
    setupMockSupabase({
      userId: USER_A_ID,
      aal: 'aal1', // Belum verifikasi TOTP MFA
      memberships: {
        [KITCHEN_A_ID]: 'maker',
      },
    });

    const route = kitchenRoute(
      ['admin', 'maker'],
      z.object({ test: z.boolean() }),
      async () => Response.json({ ok: true }),
    );

    const req = new Request(`http://localhost:3000/api/k/${KITCHEN_A_ID}/test`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
      },
      body: JSON.stringify({ test: true }),
    });

    const res = await route(req, {
      params: Promise.resolve({ kitchenId: KITCHEN_A_ID }),
    });

    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('MFA');
  });
});
