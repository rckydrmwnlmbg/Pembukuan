import { describe, expect, it } from 'vitest';
import {
  assertValidEntryAmounts,
  computePeriodLedger,
  type LedgerEntryInput,
} from '@/lib/ledger-math';

describe('src/lib/ledger-math.ts', () => {
  it('menolak transaksi dengan debit dan kredit positif sekaligus atau negatif', () => {
    expect(() => assertValidEntryAmounts(-1n, 0n)).toThrow();
    expect(() => assertValidEntryAmounts(0n, -6500n)).toThrow();
    expect(() => assertValidEntryAmounts(10000n, 6500n)).toThrow();
    expect(() => assertValidEntryAmounts(10000n, 0n)).not.toThrow();
  });

  it('menghitung saldo berjalan dan mengabaikan baris berstatus void', () => {
    const entries: LedgerEntryInput[] = [
      {
        id: 'tx-2',
        seqNo: 2,
        txDate: '2026-03-02',
        kind: 'outgoing',
        referenceNo: '202603020001',
        description: 'Pembelian bahan baku sayur sintetis',
        debit: 0n,
        credit: 2_430_000n,
        status: 'posted',
      },
      {
        id: 'tx-3',
        seqNo: 3,
        txDate: '2026-03-02',
        kind: 'admin_fee',
        referenceNo: '202603020001',
        description: 'ADMIN BANK',
        debit: 0n,
        credit: 6_500n,
        status: 'posted',
      },
      {
        id: 'tx-1',
        seqNo: 1,
        txDate: '2026-03-01',
        kind: 'incoming',
        referenceNo: null,
        description: 'PENAMBAHAN DANA DARI BGN KE VA DAPUR',
        debit: 50_000_000n,
        credit: 0n,
        status: 'posted',
      },
      {
        id: 'tx-4',
        seqNo: 4,
        txDate: '2026-03-03',
        kind: 'outgoing',
        referenceNo: '202603030099',
        description: 'Transaksi salah ketik yang dibatalkan',
        debit: 0n,
        credit: 9_999_999n,
        status: 'void',
      },
    ];

    const openingBalance = 120_000_000n;
    const { rows, summary } = computePeriodLedger(openingBalance, entries);

    expect(rows.map((r) => r.id)).toEqual(['tx-1', 'tx-2', 'tx-3', 'tx-4']);
    expect(rows[0]?.runningBalance).toBe(170_000_000n);
    expect(rows[1]?.runningBalance).toBe(167_570_000n);
    expect(rows[2]?.runningBalance).toBe(167_563_500n);
    expect(rows[3]?.runningBalance).toBe(167_563_500n);

    expect(summary).toEqual({
      openingBalance: 120_000_000n,
      totalIncoming: 50_000_000n,
      totalOutgoing: 2_436_500n,
      closingBalance: 167_563_500n,
      incomingCount: 1,
      outgoingCount: 2,
    });
  });

  it('memenuhi invarian saldo akhir = saldo awal + Σ debit - Σ kredit pada 200 transaksi sintetis', () => {
    const entries: LedgerEntryInput[] = [];
    let independentDebit = 0n;
    let independentCredit = 0n;

    for (let i = 1; i <= 200; i += 1) {
      const isIncoming = i % 25 === 0;
      const isVoid = i % 19 === 0;
      const amount = BigInt(i * 15_000 + 6_500);
      const debit = isIncoming ? amount : 0n;
      const credit = isIncoming ? 0n : amount;

      if (!isVoid) {
        independentDebit += debit;
        independentCredit += credit;
      }

      entries.push({
        id: `syn-${String(i).padStart(4, '0')}`,
        seqNo: i,
        txDate: `2026-03-${String((i % 28) + 1).padStart(2, '0')}`,
        kind: isIncoming ? 'incoming' : 'outgoing',
        referenceNo: isIncoming ? null : `20260301REF${i}`,
        description: `Transaksi sintetis #${i}`,
        debit,
        credit,
        status: isVoid ? 'void' : 'posted',
      });
    }

    const opening = 85_000_000n;
    const { rows, summary } = computePeriodLedger(opening, entries);
    const expectedClosing = opening + independentDebit - independentCredit;

    expect(summary.closingBalance).toBe(expectedClosing);
    expect(rows[rows.length - 1]?.runningBalance).toBe(expectedClosing);
  });
});
