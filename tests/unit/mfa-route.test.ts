import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('SECURITY S-01: Rute Verifikasi MFA Dedicated (F-003)', () => {
  it('memastikan berkas src/app/login/mfa/page.tsx ada sebagai tujuan redirect AAL2', () => {
    const mfaPagePath = path.resolve(process.cwd(), 'src/app/login/mfa/page.tsx');
    const exists = fs.existsSync(mfaPagePath);
    expect(exists, 'Berkas src/app/login/mfa/page.tsx wajib ada agar redirect AAL2 tidak menghasilkan 404').toBe(true);
  });
});
