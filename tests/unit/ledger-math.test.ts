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

  it('memenuhi invarian saldo akhir = saldo awal + Σ debit - Σ kredit pada 1000 transaksi sintetis acak (SKILLS.md §2)', () => {
    const entries: LedgerEntryInput[] = [];
    let independentDebit = 0n;
    let independentCredit = 0n;

    // PRNG deterministik untuk 1000 transaksi sintetis acak (tanggal acak, urutan acak, sebagian void)
    let state = 987654321;
    const nextRand = () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    for (let i = 1; i <= 1000; i += 1) {
      const r = nextRand();
      const isIncoming = r < 0.15;
      const isAdminFee = !isIncoming && r > 0.75;
      const isVoid = nextRand() < 0.08;
      const day = Math.floor(nextRand() * 28) + 1;
      const amount = isAdminFee
        ? 6_500n
        : BigInt((Math.floor(nextRand() * 900) + 10) * 5_000);
      const debit = isIncoming ? amount : 0n;
      const credit = isIncoming ? 0n : amount;

      if (!isVoid) {
        independentDebit += debit;
        independentCredit += credit;
      }

      entries.push({
        id: `syn-${String(i).padStart(4, '0')}`,
        seqNo: i,
        txDate: `2026-03-${String(day).padStart(2, '0')}`,
        kind: isIncoming ? 'incoming' : isAdminFee ? 'admin_fee' : 'outgoing',
        referenceNo: isIncoming ? null : `202603${String(day).padStart(2, '0')}REF${i}`,
        description: `Transaksi sintetis acak #${i}`,
        debit,
        credit,
        status: isVoid ? 'void' : 'posted',
      });
    }

    const opening = 185_500_000n;
    const { rows, summary } = computePeriodLedger(opening, entries);
    const expectedClosing = opening + independentDebit - independentCredit;

    expect(rows.length).toBe(1000);
    expect(summary.closingBalance).toBe(expectedClosing);
    expect(rows[rows.length - 1]?.runningBalance).toBe(expectedClosing);
  });
});
