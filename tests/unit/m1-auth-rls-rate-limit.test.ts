import { describe, expect, it } from 'vitest';
import { verifyRlsMigrationsAndTests } from '../../scripts/run-rls-tests.mjs';
import { InMemorySlidingWindowLimiter } from '@/server/security/rate-limit';
import { buildCspHeader } from '@/middleware';

describe('Milestone M1 — RLS, Rate Limiting, & CSP (SECURITY S-02, S-09, S-10, S-15)', () => {
  it('memverifikasi seluruh 11 tabel domain MVP memiliki RLS + FORCE RLS + non-delete + kunci periode', () => {
    const result = verifyRlsMigrationsAndTests();
    expect(result.violations).toEqual([]);
    expect(result.tablesVerified.sort()).toEqual(
      [
        'audit_logs',
        'bank_accounts',
        'categories',
        'counterparty_rules',
        'kitchen_members',
        'kitchens',
        'organizations',
        'periods',
        'profiles',
        'transactions',
        'uploads',
      ].sort(),
    );
  });

  it('membatasi percobaan login/MFA ke-6 dalam jendela waktu yang sama (SECURITY S-09)', async () => {
    const limiter = new InMemorySlidingWindowLimiter(5, 15 * 60 * 1000);
    const key = 'email:test-maker-hash';

    for (let i = 1; i <= 5; i += 1) {
      const res = await limiter.limit(key);
      expect(res.success).toBe(true);
    }

    const sixthAttempt = await limiter.limit(key);
    expect(sixthAttempt.success).toBe(false);
    expect(sixthAttempt.remaining).toBe(0);
    expect(sixthAttempt.reset).toBeGreaterThan(Date.now());
  });

  it('membangun header Content-Security-Policy berbasis nonce yang ketat (SECURITY S-10)', () => {
    const csp = buildCspHeader(
      'testNonce123==',
      'https://project-ref.supabase.co',
    );
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self' 'nonce-testNonce123==' 'strict-dynamic'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain('https://project-ref.supabase.co');
  });
});
