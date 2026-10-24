import { describe, expect, it } from 'vitest';
import { generateDemoDataset } from '@/lib/demo-data';

describe('src/lib/demo-data.ts (SKILLS.md bagian 8: demo-data-seeder)', () => {
  it('menghasilkan 5 dapur sintetis secara deterministik dengan rekening berawalan 9990', () => {
    const run1 = generateDemoDataset(20261025);
    const run2 = generateDemoDataset(20261025);

    expect(run1.kitchens.length).toBe(5);
    expect(run1.kitchens.map((k) => k.summary.closingBalance)).toEqual(
      run2.kitchens.map((k) => k.summary.closingBalance),
    );

    for (const kitchen of run1.kitchens) {
      expect(kitchen.accountNo.startsWith('9990')).toBe(true);
      expect(kitchen.entries.length).toBeGreaterThanOrEqual(100);
      expect(kitchen.entries.length).toBeLessThanOrEqual(140);
    }
  });

  it('memastikan saldo akhir setiap dapur demo sama persis dengan penjumlahan independen', () => {
    const dataset = generateDemoDataset();

    for (const kitchen of dataset.kitchens) {
      let independentDebit = 0n;
      let independentCredit = 0n;

      for (const tx of kitchen.entries) {
        if (tx.status === 'posted') {
          independentDebit += tx.debit;
          independentCredit += tx.credit;
        }
      }

      const expectedClosing =
        kitchen.openingBalance + independentDebit - independentCredit;

      expect(kitchen.summary.closingBalance).toBe(expectedClosing);
      const lastRow = kitchen.entries[kitchen.entries.length - 1];
      expect(lastRow?.runningBalance).toBe(expectedClosing);
    }
  });

  it('memastikan baris admin_fee berbagi nomor referensi dengan transaksi induk dan mencakup semua keadaan UI MVP (OI-01)', () => {
    const dataset = generateDemoDataset();

    for (const kitchen of dataset.kitchens) {
      const adminFees = kitchen.entries.filter((e) => e.kind === 'admin_fee');
      expect(adminFees.length).toBeGreaterThan(0);

      for (const fee of adminFees) {
        expect(fee.credit).toBe(6_500n);
        expect(fee.referenceNo).not.toBeNull();
        const matchingParent = kitchen.entries.find(
          (e) =>
            e.kind === 'outgoing' && e.referenceNo === fee.referenceNo,
        );
        expect(matchingParent).toBeDefined();
      }
    }

    const hasCleanOpen = dataset.kitchens.some(
      (k) => k.periodStatus === 'open' && k.pendingDraftCount === 0,
    );
    const hasPendingDrafts = dataset.kitchens.some(
      (k) => k.pendingDraftCount > 0,
    );
    const hasLocked = dataset.kitchens.some(
      (k) =>
        k.periodStatus === 'locked' &&
        k.nextPeriodOpeningBalance === k.summary.closingBalance,
    );
    const hasNeedsManual = dataset.uploads.some(
      (u) => u.status === 'needs_manual',
    );

    expect(hasCleanOpen).toBe(true);
    expect(hasPendingDrafts).toBe(true);
    expect(hasLocked).toBe(true);
    expect(hasNeedsManual).toBe(true);
  });
});
