import { describe, expect, it } from 'vitest';
import { scanApiRoutes } from '../../scripts/check-routes.mjs';
import { scanSecrets } from '../../scripts/check-secrets.mjs';

describe('Skrip keamanan CI (check:routes & check:secrets)', () => {
  it('memastikan seluruh route.ts di repositori lulus pemeriksaan otorisasi S-07', () => {
    const result = scanApiRoutes();
    expect(result.violations).toEqual([]);
  });

  it('memastikan tidak ada rahasia ter-hardcode di repositori S-04', () => {
    const result = scanSecrets();
    expect(result.violations).toEqual([]);
  }, 15_000);
});
