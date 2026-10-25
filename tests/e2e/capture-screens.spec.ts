import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import path from 'node:path';

const VIEWPORTS = [
  { name: '1440', width: 1440, height: 900 },
  { name: '1024', width: 1024, height: 768 },
  { name: '390', width: 390, height: 844 },
];

const SCREENS = [
  { name: 'homepage', path: '/' },
  { name: 'login', path: '/login' },
  { name: 'dashboard', path: '/dashboard' },
  { name: 'ledger', path: '/k/10000000-0000-4000-8000-000000000001/ledger' },
  { name: 'review', path: '/k/10000000-0000-4000-8000-000000000002/review' },
  { name: 'settings', path: '/k/10000000-0000-4000-8000-000000000001/settings' },
  { name: 'audit', path: '/k/10000000-0000-4000-8000-000000000001/audit' },
  { name: 'dev-ui', path: '/dev/ui' },
];

test.describe('Penerimaan Visual & Aksesibilitas (Milestone M5 - DESIGN.md §13)', () => {
  for (const screen of SCREENS) {
    for (const vp of VIEWPORTS) {
      test(`Tangkapan layar & visual audit: ${screen.name} @ ${vp.name}px`, async ({
        page,
      }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(screen.path, { waitUntil: 'networkidle' });

        // Simpan tangkapan layar ke docs/screens/<screen>-<width>.png
        const screenshotPath = path.join(
          process.cwd(),
          'docs',
          'screens',
          `${screen.name}-${vp.name}.png`,
        );

        await page.screenshot({ path: screenshotPath, fullPage: true });

        // Verifikasi elemen ada di halaman
        await expect(page.locator('body')).toBeVisible();

        // Uji Aksesibilitas Otomatis via Axe Core pada viewport desktop
        if (vp.name === '1440') {
          const axeResults = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa'])
            // Kecualikan aturan warna jika ada elemen demo yang disengaja atau transisi
            .analyze();

          // Pastikan tidak ada pelanggaran critical
          const criticalViolations = axeResults.violations.filter(
            (v) => v.impact === 'critical',
          );
          expect(criticalViolations).toEqual([]);
        }
      });
    }
  }
});
