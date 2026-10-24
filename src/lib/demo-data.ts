/**
 * Generator data demo 100% sintetis & deterministik (SKILLS.md bagian 8: demo-data-seeder & OI-01).
 * ATURAN KERAS (AGENTS.md #6):
 * - Dilarang menyalin nama, nomor rekening, atau nominal dari berkas Excel asli.
 * - Semua nomor rekening diawali '9990' agar jelas dikenali sebagai data sintetis.
 * - Lima dapur demo berdiri sendiri dengan saldo terisolasi.
 */

import {
  computePeriodLedger,
  type ComputedLedgerRow,
  type LedgerEntryInput,
  type PeriodBalanceSummary,
} from './ledger-math';
import type { PeriodStatus, UploadStatus } from '@/types/domain';

export interface DemoKitchen {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  pjName: string;
  bankCode: string;
  accountNo: string; // selalu berawalan 9990
  accountNoLast4: string;
  adminFeeDefault: bigint;
  highAmountThreshold: bigint;
  periodId: string;
  year: number;
  month: number;
  openingBalance: bigint;
  periodStatus: PeriodStatus;
  nextPeriodOpeningBalance: bigint | null; // terisi otomatis bila periodStatus === 'locked'
  pendingDraftCount: number;
  needsManualCount: number;
  lastUploadDate: string;
  entries: ComputedLedgerRow[];
  summary: PeriodBalanceSummary;
}

export interface DemoUploadItem {
  id: string;
  kitchenId: string;
  periodId: string;
  originalName: string;
  mime: 'application/pdf' | 'image/jpeg' | 'image/png';
  status: UploadStatus;
  txDate: string | null;
  referenceNo: string | null;
  amount: string | null;
  recipientAccount: string | null;
  recipientName: string | null;
  recipientBank: string | null;
  suggestedDescription: string | null;
  consistencyFlags: string[];
  lowConfidenceFields: string[];
}

export interface DemoDataset {
  organization: {
    id: string;
    name: string;
  };
  kitchens: DemoKitchen[];
  uploads: DemoUploadItem[];
}

/**
 * PRNG deterministik sederhana (Mulberry32) agar fixture & tangkapan layar selalu stabil.
 */
function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface SyntheticCounterparty {
  accountNo: string;
  name: string;
  bank: string;
  descriptionTemplate: (day: number, qty: number) => string;
  minAmount: number;
  maxAmount: number;
}

const SYNTHETIC_COUNTERPARTIES: readonly SyntheticCounterparty[] = [
  {
    accountNo: '999010018821',
    name: 'UD Pangan Segar Nusantara (Contoh)',
    bank: 'BNI',
    descriptionTemplate: (day, qty) =>
      `Pembelian bahan baku sayur & bumbu ${qty} porsi periode ${day} Maret`,
    minAmount: 1_850_000,
    maxAmount: 4_600_000,
  },
  {
    accountNo: '999020024419',
    name: 'CV Tirta Murni Sentosa (Contoh)',
    bank: 'BCA',
    descriptionTemplate: (_day, qty) =>
      `Pengisian air galon ${qty} galon @ Rp 19.000`,
    minAmount: 380_000,
    maxAmount: 950_000,
  },
  {
    accountNo: '999030037752',
    name: 'Koperasi Karya Mandiri (Contoh)',
    bank: 'MANDIRI',
    descriptionTemplate: (day, qty) =>
      `Pembelian beras & telur ${qty} kg tanggal ${day} Maret`,
    minAmount: 3_200_000,
    maxAmount: 7_500_000,
  },
  {
    accountNo: '999040049913',
    name: 'Jasa Angkut Niaga Fiktif',
    bank: 'BRI',
    descriptionTemplate: (day) =>
      `Sewa kendaraan distribusi makanan tanggal ${day} Maret`,
    minAmount: 750_000,
    maxAmount: 1_500_000,
  },
  {
    accountNo: '999050056634',
    name: 'Pengelola Gedung Sintetis',
    bank: 'BPD JATENG',
    descriptionTemplate: () => `Insentif fasilitas dan kebersihan dapur`,
    minAmount: 1_200_000,
    maxAmount: 2_500_000,
  },
  {
    accountNo: '999060061190',
    name: 'Rekening Masing-Masing Relawan (Contoh)',
    bank: 'BNI',
    descriptionTemplate: (day) =>
      `Honorarium relawan dapur periode minggu ke-${Math.ceil(day / 7)}`,
    minAmount: 6_500_000,
    maxAmount: 12_000_000,
  },
];

const SYNTHETIC_KITCHEN_SPECS = [
  {
    id: '10000000-0000-4000-8000-000000000001',
    periodId: '20000000-0000-4000-8000-000000000001',
    name: 'Dapur Sintetis Cempaka',
    code: 'DS-CMP',
    pjName: 'Rina Kartika (Contoh)',
    bankCode: 'BNI',
    accountNo: '999088001001',
    openingBalance: 115_000_000n,
    periodStatus: 'open' as PeriodStatus,
    pendingDraftCount: 0,
    needsManualCount: 0,
    txCountTarget: 110,
  },
  {
    id: '10000000-0000-4000-8000-000000000002',
    periodId: '20000000-0000-4000-8000-000000000002',
    name: 'Dapur Sintetis Kenanga',
    code: 'DS-KNG',
    pjName: 'Darmawan Putra (Contoh)',
    bankCode: 'BNI',
    accountNo: '999088001002',
    openingBalance: 98_500_000n,
    periodStatus: 'open' as PeriodStatus,
    pendingDraftCount: 3,
    needsManualCount: 0,
    txCountTarget: 118,
  },
  {
    id: '10000000-0000-4000-8000-000000000003',
    periodId: '20000000-0000-4000-8000-000000000003',
    name: 'Dapur Sintetis Melati',
    code: 'DS-MLT',
    pjName: 'Lestari Wulandari (Contoh)',
    bankCode: 'BNI',
    accountNo: '999088001003',
    openingBalance: 124_000_000n,
    periodStatus: 'open' as PeriodStatus,
    pendingDraftCount: 1,
    needsManualCount: 1,
    txCountTarget: 126,
  },
  {
    id: '10000000-0000-4000-8000-000000000004',
    periodId: '20000000-0000-4000-8000-000000000004',
    name: 'Dapur Sintetis Anggrek',
    code: 'DS-ANG',
    pjName: 'Hendra Wijaya (Contoh)',
    bankCode: 'BNI',
    accountNo: '999088001004',
    openingBalance: 140_000_000n,
    periodStatus: 'locked' as PeriodStatus,
    pendingDraftCount: 0,
    needsManualCount: 0,
    txCountTarget: 108,
  },
  {
    id: '10000000-0000-4000-8000-000000000005',
    periodId: '20000000-0000-4000-8000-000000000005',
    name: 'Dapur Sintetis Dahlia',
    code: 'DS-DHL',
    pjName: 'Nadia Pramesti (Contoh)',
    bankCode: 'BNI',
    accountNo: '999088001005',
    openingBalance: 105_000_000n,
    periodStatus: 'open' as PeriodStatus,
    pendingDraftCount: 2,
    needsManualCount: 0,
    txCountTarget: 114,
  },
] as const;

export function generateDemoDataset(seed = 20261025): DemoDataset {
  const rand = createSeededRandom(seed);
  const orgId = '00000000-0000-4000-8000-000000000099';
  const kitchens: DemoKitchen[] = [];
  const uploads: DemoUploadItem[] = [];

  for (let kIdx = 0; kIdx < SYNTHETIC_KITCHEN_SPECS.length; kIdx += 1) {
    const spec = SYNTHETIC_KITCHEN_SPECS[kIdx]!;
    const entries: LedgerEntryInput[] = [];
    let seqNo = 1;

    // 2 transaksi dana masuk BGN tanpa nomor referensi (meniru pola buku kas sumber)
    const incomingDays = [2, 16];
    for (const day of incomingDays) {
      const dateStr = `2026-03-${String(day).padStart(2, '0')}`;
      entries.push({
        id: `tx-${spec.code}-inc-${seqNo}`,
        seqNo,
        txDate: dateStr,
        kind: 'incoming',
        referenceNo: null,
        description: 'PENAMBAHAN DANA DARI BGN KE VA DAPUR (CONTOH)',
        debit: 150_000_000n,
        credit: 0n,
        status: 'posted',
      });
      seqNo += 1;
    }

    // Buat transaksi keluar + pasangan biaya admin Rp 6.500 bila beda bank
    while (entries.length < spec.txCountTarget) {
      const day = Math.floor(rand() * 28) + 1;
      const dateStr = `2026-03-${String(day).padStart(2, '0')}`;
      const cpIndex = Math.floor(rand() * SYNTHETIC_COUNTERPARTIES.length);
      const cp = SYNTHETIC_COUNTERPARTIES[cpIndex]!;
      const qty = Math.floor(rand() * 250) + 100;
      const rawStep =
        cp.minAmount +
        Math.floor(rand() * ((cp.maxAmount - cp.minAmount) / 5_000)) * 5_000;
      const amount = BigInt(rawStep);
      const refNo = `202603${String(day).padStart(2, '0')}${String(kIdx + 1)}${String(seqNo).padStart(4, '0')}`;

      entries.push({
        id: `tx-${spec.code}-out-${seqNo}`,
        seqNo,
        txDate: dateStr,
        kind: 'outgoing',
        referenceNo: refNo,
        description: cp.descriptionTemplate(day, qty),
        debit: 0n,
        credit: amount,
        status: 'posted',
      });
      seqNo += 1;

      if (cp.bank !== spec.bankCode && entries.length < spec.txCountTarget) {
        entries.push({
          id: `tx-${spec.code}-adm-${seqNo}`,
          seqNo,
          txDate: dateStr,
          kind: 'admin_fee',
          referenceNo: refNo, // berbagi nomor referensi yang sama dengan transaksi induk (PRD FR-F4.3)
          description: 'ADMIN BANK',
          debit: 0n,
          credit: 6_500n,
          status: 'posted',
        });
        seqNo += 1;
      }
    }

    const { rows, summary } = computePeriodLedger(spec.openingBalance, entries);

    kitchens.push({
      id: spec.id,
      organizationId: orgId,
      name: spec.name,
      code: spec.code,
      pjName: spec.pjName,
      bankCode: spec.bankCode,
      accountNo: spec.accountNo,
      accountNoLast4: spec.accountNo.slice(-4),
      adminFeeDefault: 6_500n,
      highAmountThreshold: 25_000_000n,
      periodId: spec.periodId,
      year: 2026,
      month: 3,
      openingBalance: spec.openingBalance,
      periodStatus: spec.periodStatus,
      nextPeriodOpeningBalance:
        spec.periodStatus === 'locked' ? summary.closingBalance : null,
      pendingDraftCount: spec.pendingDraftCount,
      needsManualCount: spec.needsManualCount,
      lastUploadDate: '2026-03-28',
      entries: rows,
      summary,
    });

    for (let d = 1; d <= spec.pendingDraftCount; d += 1) {
      uploads.push({
        id: `upl-${spec.code}-draft-${d}`,
        kitchenId: spec.id,
        periodId: spec.periodId,
        originalName: `bukti-transfer-sintetis-${spec.code.toLowerCase()}-0${d}.jpg`,
        mime: 'image/jpeg',
        status: 'parsed',
        txDate: '2026-03-28',
        referenceNo: `20260328DRF${kIdx + 1}0${d}`,
        amount: String(1_450_000 + d * 250_000),
        recipientAccount: '999010018821',
        recipientName: 'UD Pangan Segar Nusantara (Contoh)',
        recipientBank: 'BCA',
        suggestedDescription: `Pembelian bahan baku sayur & bumbu 300 porsi periode 28 Maret`,
        consistencyFlags: [],
        lowConfidenceFields: d === 2 ? ['referenceNo'] : [],
      });
    }

    for (let m = 1; m <= spec.needsManualCount; m += 1) {
      uploads.push({
        id: `upl-${spec.code}-manual-${m}`,
        kitchenId: spec.id,
        periodId: spec.periodId,
        originalName: `bukti-buram-sintetis-${spec.code.toLowerCase()}-0${m}.jpg`,
        mime: 'image/jpeg',
        status: 'needs_manual',
        txDate: null,
        referenceNo: null,
        amount: null,
        recipientAccount: null,
        recipientName: null,
        recipientBank: null,
        suggestedDescription: null,
        consistencyFlags: ['nominal_tidak_valid'],
        lowConfidenceFields: ['txDate', 'referenceNo', 'amount'],
      });
    }
  }

  return {
    organization: {
      id: orgId,
      name: 'Yayasan Kuliner Sosial Nusantara (Data Contoh)',
    },
    kitchens,
    uploads,
  };
}
