/**
 * Fungsi murni perhitungan saldo buku kas per dapur (AGENTS.md bagian 2 #2, bagian 6, bagian 7, & OI-04).
 * Seluruh nominal wajib bertipe bigint. Dilarang memakai float/Number untuk perhitungan uang.
 */

export type TransactionKind = 'incoming' | 'outgoing' | 'admin_fee';
export type TransactionStatus = 'posted' | 'void';

export interface LedgerEntryInput {
  id: string;
  seqNo: number;
  txDate: string; // 'YYYY-MM-DD'
  kind: TransactionKind;
  referenceNo: string | null;
  description: string;
  debit: bigint;
  credit: bigint;
  status: TransactionStatus;
}

export interface ComputedLedgerRow extends LedgerEntryInput {
  runningBalance: bigint;
}

export interface PeriodBalanceSummary {
  openingBalance: bigint;
  totalIncoming: bigint;
  totalOutgoing: bigint;
  closingBalance: bigint;
  incomingCount: number;
  outgoingCount: number;
}

/**
 * Memvalidasi invarian satu baris transaksi (SKILLS.md bagian 2):
 * - debit >= 0n dan credit >= 0n
 * - tidak boleh memiliki debit > 0n dan credit > 0n sekaligus
 */
export function assertValidEntryAmounts(debit: bigint, credit: bigint): void {
  if (debit < 0n || credit < 0n) {
    throw new Error('Nominal debit dan kredit tidak boleh negatif.');
  }
  if (debit > 0n && credit > 0n) {
    throw new Error('Satu transaksi tidak boleh memiliki debit dan kredit sekaligus.');
  }
}

/**
 * Mengurutkan transaksi berdasarkan txDate (naik), lalu seqNo (naik), lalu id sebagai penentu akhir.
 */
export function sortLedgerEntries<T extends Pick<LedgerEntryInput, 'txDate' | 'seqNo' | 'id'>>(
  entries: readonly T[],
): T[] {
  return [...entries].sort((a, b) => {
    if (a.txDate !== b.txDate) {
      return a.txDate < b.txDate ? -1 : 1;
    }
    if (a.seqNo !== b.seqNo) {
      return a.seqNo - b.seqNo;
    }
    return a.id.localeCompare(b.id);
  });
}

/**
 * Menghitung saldo berjalan (running balance) dan ringkasan persamaan saldo periode
 * untuk satu dapur dan satu periode (OI-04):
 *   Saldo akhir = Saldo awal + Dana masuk - Dana keluar
 * Transaksi berstatus 'void' tetap ada di daftar dengan runningBalance tidak mengubah saldo.
 */
export function computePeriodLedger(
  openingBalance: bigint,
  entries: readonly LedgerEntryInput[],
): {
  rows: ComputedLedgerRow[];
  summary: PeriodBalanceSummary;
} {
  const sorted = sortLedgerEntries(entries);
  let currentBalance = openingBalance;
  let totalIncoming = 0n;
  let totalOutgoing = 0n;
  let incomingCount = 0;
  let outgoingCount = 0;

  const rows: ComputedLedgerRow[] = sorted.map((entry) => {
    assertValidEntryAmounts(entry.debit, entry.credit);

    if (entry.status === 'posted') {
      currentBalance = currentBalance + entry.debit - entry.credit;
      if (entry.debit > 0n) {
        totalIncoming += entry.debit;
        incomingCount += 1;
      }
      if (entry.credit > 0n) {
        totalOutgoing += entry.credit;
        outgoingCount += 1;
      }
    }

    return {
      ...entry,
      runningBalance: currentBalance,
    };
  });

  const closingBalance = openingBalance + totalIncoming - totalOutgoing;

  return {
    rows,
    summary: {
      openingBalance,
      totalIncoming,
      totalOutgoing,
      closingBalance,
      incomingCount,
      outgoingCount,
    },
  };
}
