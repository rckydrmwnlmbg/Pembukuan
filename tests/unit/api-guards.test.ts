import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { requireUser } from '@/server/auth/require-user';
import { kitchenRoute } from '@/server/http/kitchen-route';
import { HttpError } from '@/server/http/errors';

// Mock createClient dari @/server/supabase/server
vi.mock('@/server/supabase/server', () => ({
  createClient: vi.fn(),
}));

// Mock redirect dari next/navigation
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    const err = new Error(`NEXT_REDIRECT: ${url}`);
    (err as unknown as { digest: string }).digest = `NEXT_REDIRECT;replace;${url};307;;`;
    throw err;
  }),
}));

import { createClient } from '@/server/supabase/server';

describe('SECURITY S-01 & S-07: Penanganan Autentikasi dan Respons Galat Route API (F-001)', () => {
  it('requireUser({ redirectOnFailure: false }) melempar HttpError(401) bila sesi tidak ada', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: new Error('Auth session missing') }),
        mfa: {
          getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({ data: null }),
        },
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    try {
      await requireUser({ redirectOnFailure: false });
      expect.fail('Harus melempar HttpError(401)');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
      expect((err as HttpError).status).toBe(401);
      expect((err as HttpError).publicMessage).toContain('login');
    }
  });

  it('requireUser({ redirectOnFailure: false }) melempar HttpError(403) bila tingkat jaminan bukan AAL2', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-123', email: 'test@sintetis.example' } },
          error: null,
        }),
        mfa: {
          getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({
            data: { currentLevel: 'aal1', nextLevel: 'aal2' },
          }),
        },
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    try {
      await requireUser({ redirectOnFailure: false });
      expect.fail('Harus melempar HttpError(403)');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
      expect((err as HttpError).status).toBe(403);
      expect((err as HttpError).publicMessage).toContain('MFA');
    }
  });

  it('kitchenRoute menghasilkan respons HTTP 401 (bukan 500) saat dipanggil tanpa sesi autentikasi', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: new Error('No session') }),
        mfa: {
          getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({ data: null }),
        },
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const testRoute = kitchenRoute(
      ['admin', 'maker'],
      z.object({ name: z.string() }),
      async () => Response.json({ ok: true }),
    );

    const req = new Request('http://localhost:3000/api/k/10000000-0000-4000-8000-000000000001/test', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
      },
      body: JSON.stringify({ name: 'test' }),
    });

    const res = await testRoute(req, {
      params: Promise.resolve({ kitchenId: '10000000-0000-4000-8000-000000000001' }),
    });

    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('login');
  });
});
