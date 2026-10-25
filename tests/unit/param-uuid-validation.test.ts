import { describe, expect, it, vi } from 'vitest';

vi.mock('@/server/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: '00000000-0000-4000-8000-000000000001', email: 'maker@sintetis.example' } },
        error: null,
      }),
      mfa: {
        getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({
          data: { currentLevel: 'aal2', nextLevel: 'aal2' },
        }),
      },
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null }),
    }),
  }),
}));

import { GET as getTransaction } from '@/app/api/k/[kitchenId]/transactions/[txId]/route';
import { POST as lockPeriod } from '@/app/api/k/[kitchenId]/periods/[periodId]/lock/route';
import { POST as unlockPeriod } from '@/app/api/k/[kitchenId]/periods/[periodId]/unlock/route';
import { GET as getUploadFile } from '@/app/api/k/[kitchenId]/uploads/[uploadId]/file/route';

describe('SECURITY S-03 & S-07: Validasi Ketat UUID pada Parameter URL (F-004)', () => {
  const kitchenId = '10000000-0000-4000-8000-000000000001';

  it('menolak txId non-UUID dengan HTTP 422', async () => {
    const req = new Request(`http://localhost/api/k/${kitchenId}/transactions/invalid-id`, {
      method: 'GET',
      headers: { host: 'localhost' },
    });
    const res = await getTransaction(req, {
      params: Promise.resolve({ kitchenId, txId: 'invalid-id' }),
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: string; fields?: Array<{ path: string }> };
    expect(body.error).toContain('belum sesuai format');
    expect(body.fields?.some((f) => f.path === 'txId')).toBe(true);
  });

  it('menolak periodId non-UUID pada lock/unlock dengan HTTP 422', async () => {
    const lockReq = new Request(`http://localhost/api/k/${kitchenId}/periods/not-a-uuid/lock`, {
      method: 'POST',
      headers: { host: 'localhost', origin: 'http://localhost', 'content-type': 'application/json' },
      body: JSON.stringify({ reason: 'Locking period' }),
    });
    const res = await lockPeriod(lockReq, {
      params: Promise.resolve({ kitchenId, periodId: 'not-a-uuid' }),
    });
    expect(res.status).toBe(422);

    const unlockReq = new Request(`http://localhost/api/k/${kitchenId}/periods/not-a-uuid/unlock`, {
      method: 'POST',
      headers: { host: 'localhost', origin: 'http://localhost', 'content-type': 'application/json' },
      body: JSON.stringify({ reason: 'Alasan pembukaan kembali lebih dari 5 huruf' }),
    });
    const unlockRes = await unlockPeriod(unlockReq, {
      params: Promise.resolve({ kitchenId, periodId: 'not-a-uuid' }),
    });
    expect(unlockRes.status).toBe(422);
  });

  it('menolak uploadId non-UUID pada file route dengan HTTP 422', async () => {
    const req = new Request(`http://localhost/api/k/${kitchenId}/uploads/evil-path-traversal/file`, {
      method: 'GET',
      headers: { host: 'localhost' },
    });
    const res = await getUploadFile(req, {
      params: Promise.resolve({ kitchenId, uploadId: 'evil-path-traversal' }),
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: string; fields?: Array<{ path: string }> };
    expect(body.fields?.some((f) => f.path === 'uploadId')).toBe(true);
  });
});
