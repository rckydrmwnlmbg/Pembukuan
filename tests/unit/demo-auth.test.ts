import { describe, expect, it, vi } from 'vitest';
import { requireUser } from '@/server/auth/require-user';
import { requireKitchenRole } from '@/server/auth/require-kitchen-role';
import {
  setDemoSessionAction,
  clearSessionAction,
  signInAction,
  verifyMfaAction,
} from '@/server/auth/actions';
import { HttpError } from '@/server/http/errors';

// Mock cookies dari next/headers
const mockCookiesStore = new Map<string, { value: string; options?: Record<string, unknown> }>();

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => mockCookiesStore.get(name),
    set: (name: string, value: string, options?: Record<string, unknown>) => {
      mockCookiesStore.set(name, { value, options });
    },
    delete: (name: string) => {
      mockCookiesStore.delete(name);
    },
    getAll: () => Array.from(mockCookiesStore.entries()).map(([name, { value }]) => ({ name, value })),
  })),
}));

describe('Autentikasi Mode Demo & Supabase Auth', () => {
  it('berhasil login dan mendapatkan sesi demo saat cookie kasdapur_session=authenticated', async () => {
    mockCookiesStore.set('kasdapur_session', { value: 'authenticated' });

    const result = await requireUser();
    expect(result.user).toBeDefined();
    expect(result.user.email).toBe('maker@sintetis.example');
    expect(result.user.id).toBe('00000000-0000-4000-8000-000000000001');
  });

  it('mengizinkan akses pengguna demo ke dapur sintetis yang valid', async () => {
    mockCookiesStore.set('kasdapur_session', { value: 'authenticated' });

    // Dapur Plombokan (valid demo kitchen)
    const validKitchenId = '10000000-0000-4000-8000-000000000001';
    const roleResult = await requireKitchenRole(validKitchenId, ['admin', 'maker']);
    expect(roleResult.role).toBe('admin');
    expect(roleResult.user.email).toBe('maker@sintetis.example');
  });

  it('menolak akses pengguna demo jika kitchenId tidak ada di dataset sintetis (404)', async () => {
    mockCookiesStore.set('kasdapur_session', { value: 'authenticated' });

    const nonExistentKitchenId = '99999999-9999-4000-8000-999999999999';
    await expect(
      requireKitchenRole(nonExistentKitchenId, ['admin', 'maker']),
    ).rejects.toThrow(HttpError);
  });

  it('setDemoSessionAction menulis cookie kasdapur_session dan clearSessionAction menghapusnya', async () => {
    mockCookiesStore.clear();

    await setDemoSessionAction();
    expect(mockCookiesStore.get('kasdapur_session')?.value).toBe('authenticated');

    await clearSessionAction();
    expect(mockCookiesStore.get('kasdapur_session')).toBeUndefined();
  });

  it('signInAction mengenali kredensial demo dan mengembalikan needMfa=true', async () => {
    mockCookiesStore.clear();

    const res = await signInAction({
      email: 'maker@sintetis.example',
      password: 'demo1234',
    });

    expect(res.isDemo).toBe(true);
    expect(res.needMfa).toBe(true);
    expect(mockCookiesStore.get('kasdapur_session')?.value).toBe('authenticated');
  });

  it('verifyMfaAction memverifikasi 6 digit kode pada sesi demo', async () => {
    mockCookiesStore.set('kasdapur_session', { value: 'authenticated' });

    const resValid = await verifyMfaAction('123456');
    expect(resValid.success).toBe(true);

    const resInvalid = await verifyMfaAction('123');
    expect(resInvalid.error).toContain('6 digit');
  });
});
