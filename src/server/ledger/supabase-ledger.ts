import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/server/supabase/admin';
import { encryptField, hashForLookup, extractLast4Digits } from '@/server/crypto/field';
import { HttpError } from '@/server/http/errors';
import { logger } from '@/server/logging/logger';
import {
  computePeriodLedger,
  type ComputedLedgerRow,
  type LedgerEntryInput,
  type PeriodBalanceSummary,
} from '@/lib/ledger-math';
import type { CreateTransactionInput } from '@/lib/schemas/transaction';
import type { PostUploadReviewInput } from '@/lib/schemas/upload';
import {
  validateAndNormalizeTransferProofBytes,
  type NormalizedUploadFile,
} from '@/server/extraction/normalize-image';
import {
  aiExtract,
  getExtractionEnv,
  type Extracted,
} from '@/server/extraction/ai-extract';
import { parseReceiptText } from '@/server/extraction/receipt-parser';
import { extractPayloadFromPdf } from '@/server/extraction/pdf-helper';
import { detectAndParseMultiTrxPdf } from '@/server/extraction/multi-trx-parser';
import {
  consistencyFlags,
  CONSISTENCY_FLAG_DESCRIPTIONS,
  getLowConfidenceFields,
  shouldFallbackToNeedsManual,
} from '@/server/extraction/checks';
import { extractLimiter } from '@/server/security/rate-limit';
import {
  type UploadRecord,
  type CounterpartyRuleRecord,
  MAX_BATCH_FILES,
  defaultUploadStore,
} from '@/server/upload/service';

export interface SupabaseKitchenMeta {
  id: string;
  code: string;
  name: string;
  pjName: string;
  bankCode: string;
  accountNoLast4: string;
  adminFeeDefault: bigint;
  highAmountThreshold: bigint;
  periodId: string;
  year: number;
  month: number;
  periodStatus: 'open' | 'locked';
  openingBalance: bigint;
  lastUploadDate: string;
  pendingDraftCount: number;
  needsManualCount: number;
  summary: PeriodBalanceSummary;
}

export interface SupabaseKitchenLedgerResult {
  kitchen: SupabaseKitchenMeta;
  rows: ComputedLedgerRow[];
  summary: PeriodBalanceSummary;
}

interface RawKitchen {
  id: string;
  code: string;
  name: string;
  pj_name: string;
  admin_fee_default?: number;
  high_amount_threshold?: number;
}
interface RawBank {
  kitchen_id: string;
  bank_code: string;
  account_no_last4: string;
}
interface RawPeriod {
  id: string;
  kitchen_id: string;
  year: number;
  month: number;
  opening_balance: number | string;
  status: string;
}
interface RawUpload {
  kitchen_id: string;
  status: string;
  created_at: string;
}

/**
 * Mengambil seluruh dapur yang dapat diakses oleh user_id dari database Supabase.
 */
export async function listUserKitchens(
  supabase: SupabaseClient,
  userId: string,
): Promise<SupabaseKitchenMeta[]> {
  // 1. Ambil membership dapur milik pengguna
  const { data: members, error: memErr } = await supabase
    .from('kitchen_members')
    .select('kitchen_id, role')
    .eq('user_id', userId);

  if (memErr) {
    // Jika tabel belum siap, tangani dengan pesan terstruktur
    if (memErr.message?.includes('does not exist')) {
      throw new HttpError(
        500,
        'Tabel database Supabase belum diinisialisasi. Silakan jalankan script SQL migrasi di Supabase SQL Editor.',
      );
    }
    return [];
  }

  if (!members || members.length === 0) {
    return [];
  }

  const kitchenIds = members.map((m) => m.kitchen_id);

  // 2. Ambil data dapur, rekening bank, periode aktif, upload tertunda, dan view saldo periode secara paralel
  const [kitchensRes, bankRes, periodsRes, uploadsRes, summaryRes] = await Promise.all([
    supabase.from('kitchens').select('*').in('id', kitchenIds),
    supabase.from('bank_accounts').select('*').in('kitchen_id', kitchenIds),
    supabase
      .from('periods')
      .select('*')
      .in('kitchen_id', kitchenIds)
      .order('year', { ascending: false })
      .order('month', { ascending: false }),
    supabase
      .from('uploads')
      .select('kitchen_id, status, created_at')
      .in('kitchen_id', kitchenIds)
      .in('status', ['uploaded', 'needs_manual']),
    Promise.resolve(
      supabase
        .from('v_period_summary')
        .select('*')
        .in('kitchen_id', kitchenIds),
    ).catch(() => ({ data: null, error: null })),
  ]);

  const rawKitchens = (kitchensRes.data || []) as RawKitchen[];
  const rawBanks = (bankRes.data || []) as RawBank[];
  const rawPeriods = (periodsRes.data || []) as RawPeriod[];
  const rawUploads = (uploadsRes.data || []) as RawUpload[];
  const rawSummaries = ((summaryRes as { data?: unknown[] } | null)?.data || []) as Record<string, unknown>[];

  // Fallback cepat satu kueri agregat bila v_period_summary tidak tersedia (misal lingkungan mock/uji)
  let fallbackTxMap: Map<string, { totalInc: bigint; totalOut: bigint; incCount: number; outCount: number }> | null = null;
  if (rawSummaries.length === 0 && rawPeriods.length > 0) {
    const activePeriodIds = rawPeriods.map((p: RawPeriod) => p.id);
    const { data: allTxs } = await supabase
      .from('transactions')
      .select('period_id, debit, credit')
      .in('period_id', activePeriodIds)
      .eq('status', 'posted');

    if (allTxs && allTxs.length > 0) {
      fallbackTxMap = new Map();
      for (const t of allTxs as { period_id: string; debit: number | string; credit: number | string }[]) {
        const pId = t.period_id;
        const cur = fallbackTxMap.get(pId) || { totalInc: 0n, totalOut: 0n, incCount: 0, outCount: 0 };
        const deb = BigInt(t.debit || 0);
        const cred = BigInt(t.credit || 0);
        if (deb > 0n) cur.incCount++;
        if (cred > 0n) cur.outCount++;
        cur.totalInc += deb;
        cur.totalOut += cred;
        fallbackTxMap.set(pId, cur);
      }
    }
  }

  const results: SupabaseKitchenMeta[] = [];

  for (const k of rawKitchens) {
    const bank = rawBanks.find((b: RawBank) => b.kitchen_id === k.id);
    const activePeriod = rawPeriods.find((p: RawPeriod) => p.kitchen_id === k.id);

    const year = activePeriod?.year ?? new Date().getFullYear();
    const month = activePeriod?.month ?? new Date().getMonth() + 1;
    const periodId = activePeriod?.id ?? crypto.randomUUID();
    const periodStatus = (activePeriod?.status ?? 'open') as 'open' | 'locked';
    const openingBalance = activePeriod ? BigInt(activePeriod.opening_balance) : 0n;

    // Ambil saldo berjalan dari view agregat PostgreSQL atau dari kueri batch fallback
    let summary: PeriodBalanceSummary = {
      openingBalance,
      totalIncoming: 0n,
      totalOutgoing: 0n,
      closingBalance: openingBalance,
      incomingCount: 0,
      outgoingCount: 0,
    };

    if (activePeriod?.id) {
      const summaryRow = rawSummaries.find(
        (s: Record<string, unknown>) => s.period_id === activePeriod.id,
      );
      if (summaryRow) {
        const inc = BigInt(summaryRow.total_incoming as string | number || 0);
        const out = BigInt(summaryRow.total_outgoing as string | number || 0);
        summary = {
          openingBalance,
          totalIncoming: inc,
          totalOutgoing: out,
          closingBalance: openingBalance + inc - out,
          incomingCount: Number(summaryRow.incoming_count || 0),
          outgoingCount: Number(summaryRow.outgoing_count || 0),
        };
      } else if (fallbackTxMap?.has(activePeriod.id)) {
        const f = fallbackTxMap.get(activePeriod.id)!;
        summary = {
          openingBalance,
          totalIncoming: f.totalInc,
          totalOutgoing: f.totalOut,
          closingBalance: openingBalance + f.totalInc - f.totalOut,
          incomingCount: f.incCount,
          outgoingCount: f.outCount,
        };
      }
    }

    const kitchenUploads = rawUploads.filter((u: RawUpload) => u.kitchen_id === k.id);
    const pendingDraftCount = kitchenUploads.filter((u: RawUpload) => u.status === 'uploaded').length;
    const needsManualCount = kitchenUploads.filter((u: RawUpload) => u.status === 'needs_manual').length;

    results.push({
      id: k.id,
      code: k.code,
      name: k.name,
      pjName: k.pj_name,
      bankCode: bank?.bank_code || 'BCA',
      accountNoLast4: bank?.account_no_last4 || '0000',
      adminFeeDefault: BigInt(k.admin_fee_default || 6500),
      highAmountThreshold: BigInt(k.high_amount_threshold || 25000000),
      periodId,
      year,
      month,
      periodStatus,
      openingBalance,
      lastUploadDate: '-',
      pendingDraftCount,
      needsManualCount,
      summary,
    });
  }

  return results;
}

/**
 * Memastikan tersedianya ID periode yang sesuai dengan txDate (PRD E8: Periode ditentukan oleh tx_date).
 * Jika belum ada periode untuk (kitchenId, year, month), fungsi ini akan membuatnya secara otomatis.
 */
export async function ensurePeriodForTxDate(
  supabase: SupabaseClient,
  kitchenId: string,
  txDate: string,
): Promise<string> {
  const [yStr, mStr] = txDate.split('-');
  const year = yStr ? parseInt(yStr, 10) : NaN;
  const month = mStr ? parseInt(mStr, 10) : NaN;
  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    throw new HttpError(400, `Format tanggal tidak valid: ${txDate}`);
  }

  // 1. Cek apakah periode (kitchen_id, year, month) sudah ada
  const { data: existingPeriod } = await supabase
    .from('periods')
    .select('id, status')
    .eq('kitchen_id', kitchenId)
    .eq('year', year)
    .eq('month', month)
    .maybeSingle();

  if (existingPeriod) {
    if (existingPeriod.status === 'locked') {
      throw new HttpError(
        409,
        `Periode ${month}/${year} sudah dikunci. Transaksi pada periode yang sudah dikunci tidak dapat ditambah.`,
      );
    }
    return existingPeriod.id as string;
  }

  // 2. Jika belum ada periode, cek apakah dapur hanya memiliki 1 periode default yang belum memiliki transaksi sama sekali
  const { data: allPeriods } = await supabase
    .from('periods')
    .select('id, year, month, opening_balance, status')
    .eq('kitchen_id', kitchenId);

  const firstP = allPeriods?.[0];
  if (allPeriods && allPeriods.length === 1 && firstP && firstP.status === 'open') {
    const { count: txCount } = await supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('period_id', firstP.id);

    if (txCount === 0) {
      // Perbarui year dan month periode kosong ini agar menjadi periode awal sesuai transaksi pertama
      await supabase
        .from('periods')
        .update({ year, month })
        .eq('id', firstP.id);
      return firstP.id as string;
    }
  }

  // 3. Jika sudah ada transaksi di periode lain, buat periode baru
  const newPeriodId = crypto.randomUUID();
  const { error: insErr } = await supabase.from('periods').insert({
    id: newPeriodId,
    kitchen_id: kitchenId,
    year,
    month,
    opening_balance: 0,
    status: 'open',
  });

  if (insErr) {
    throw new HttpError(
      500,
      `Gagal membuat periode otomatis untuk ${month}/${year}: ${insErr.message}`,
    );
  }

  return newPeriodId;
}

/**
 * Menyinkronkan dan memulihkan period_id transaksi agar selaras dengan tx_date (PRD E8).
 * Menangani kasus di mana transaksi diinput sebelum perbaikan ini dan tersangkut pada periode yang salah.
 */
export async function reconcileKitchenPeriods(
  supabase: SupabaseClient,
  kitchenId: string,
): Promise<void> {
  try {
    const [periodsRes, txsRes] = await Promise.all([
      supabase.from('periods').select('*').eq('kitchen_id', kitchenId),
      supabase.from('transactions').select('id, period_id, tx_date').eq('kitchen_id', kitchenId),
    ]);

    const rawPeriods = (periodsRes.data || []) as RawPeriod[];
    const rawTxs = (txsRes.data || []) as { id: string; period_id: string; tx_date: string }[];

    if (rawPeriods.length === 0 || rawTxs.length === 0) return;

    const periodMap = new Map<string, { id: string; year: number; month: number; opening_balance: number; status: string }>();
    for (const p of rawPeriods) {
      periodMap.set(p.id, {
        id: p.id,
        year: p.year,
        month: p.month,
        opening_balance: Number(p.opening_balance || 0),
        status: p.status,
      });
    }

    // Kasus umum: 1 periode default terbuka, dan semua transaksi berada pada bulan/tahun yang berbeda
    const defaultP = rawPeriods[0];
    if (rawPeriods.length === 1 && defaultP && defaultP.status === 'open') {
      const uniqueTxPeriods = new Set(
        rawTxs.map((t) => {
          const [y, m] = t.tx_date.split('-');
          return `${y || ''}-${m || ''}`;
        }),
      );

      const uniqueArr = Array.from(uniqueTxPeriods);
      if (uniqueArr.length === 1 && uniqueArr[0]) {
        const [txYearStr, txMonthStr] = uniqueArr[0].split('-');
        const txYear = txYearStr ? parseInt(txYearStr, 10) : NaN;
        const txMonth = txMonthStr ? parseInt(txMonthStr, 10) : NaN;

        if (!isNaN(txYear) && !isNaN(txMonth) && (defaultP.year !== txYear || defaultP.month !== txMonth)) {
          await supabase
            .from('periods')
            .update({ year: txYear, month: txMonth })
            .eq('id', defaultP.id);
          return;
        }
      }
    }

    // Periksa transaksi yang period_id-nya tidak sesuai tahun dan bulan tx_date
    for (const t of rawTxs) {
      if (!t.tx_date) continue;
      const [txYearStr, txMonthStr] = t.tx_date.split('-');
      const txYear = txYearStr ? parseInt(txYearStr, 10) : NaN;
      const txMonth = txMonthStr ? parseInt(txMonthStr, 10) : NaN;
      if (isNaN(txYear) || isNaN(txMonth)) continue;

      const curP = periodMap.get(t.period_id);
      if (curP && curP.year === txYear && curP.month === txMonth) {
        continue;
      }

      // Cari atau buat periode yang tepat
      let targetP = Array.from(periodMap.values()).find(
        (p) => p.year === txYear && p.month === txMonth,
      );

      if (!targetP) {
        const newPId = crypto.randomUUID();
        const { error: insErr } = await supabase.from('periods').insert({
          id: newPId,
          kitchen_id: kitchenId,
          year: txYear,
          month: txMonth,
          opening_balance: 0,
          status: 'open',
        });
        if (!insErr) {
          targetP = {
            id: newPId,
            year: txYear,
            month: txMonth,
            opening_balance: 0,
            status: 'open',
          };
          periodMap.set(newPId, targetP);
        }
      }

      if (targetP) {
        await supabase
          .from('transactions')
          .update({ period_id: targetP.id })
          .eq('id', t.id);
      }
    }
  } catch {
    // Non-blocking, jangan gagalkan alur utama
  }
}

/**
 * Mengambil buku kas satu dapur lengkap dengan baris transaksi dan ringkasan saldo.
 */
export async function getKitchenLedger(
  supabase: SupabaseClient,
  kitchenId: string,
  periodId?: string,
): Promise<SupabaseKitchenLedgerResult> {
  // Selaraskan periode transaksi otomatis jika ada tanggal transaksi yang melenceng dari periodenya
  await reconcileKitchenPeriods(supabase, kitchenId);

  // 1. Ambil info dapur, rekening bank, dan periode secara paralel untuk meminimalkan latensi
  let periodQuery = supabase
    .from('periods')
    .select('*')
    .eq('kitchen_id', kitchenId);

  if (periodId) {
    periodQuery = periodQuery.eq('id', periodId);
  } else {
    periodQuery = periodQuery
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .limit(1);
  }

  const [kitchenRes, bankRes, periodsRes] = await Promise.all([
    supabase.from('kitchens').select('*').eq('id', kitchenId).single(),
    supabase.from('bank_accounts').select('*').eq('kitchen_id', kitchenId).maybeSingle(),
    periodQuery,
  ]);

  if (kitchenRes.error || !kitchenRes.data) {
    throw new HttpError(404, 'Dapur tidak ditemukan.');
  }

  if (periodsRes.error) {
    throw new HttpError(500, `Gagal memuat periode: ${periodsRes.error.message}`);
  }

  const k = kitchenRes.data;
  const bank = bankRes.data;
  const activePeriod = periodsRes.data?.[0];

  if (!activePeriod) {
    throw new HttpError(404, 'Periode pembukuan tidak ditemukan untuk dapur ini.');
  }

  const openingBalance = BigInt(activePeriod.opening_balance || 0);

  // 3. Ambil seluruh transaksi dalam periode ini
  const { data: rawTxs, error: txErr } = await supabase
    .from('transactions')
    .select('*')
    .eq('kitchen_id', kitchenId)
    .eq('period_id', activePeriod.id)
    .order('tx_date', { ascending: true })
    .order('seq_no', { ascending: true })
    .order('id', { ascending: true });

  if (txErr) {
    throw new HttpError(500, `Gagal memuat transaksi: ${txErr.message}`);
  }

  const entries: LedgerEntryInput[] = (rawTxs || []).map((t) => ({
    id: t.id,
    kitchenId: t.kitchen_id,
    periodId: t.period_id,
    parentTransactionId: t.parent_transaction_id ?? null,
    seqNo: t.seq_no,
    txDate: t.tx_date,
    kind: t.kind,
    referenceNo: t.reference_no ?? null,
    description: t.description,
    counterpartyAccount: null,
    counterpartyAccountLast4: t.counterparty_account_last4 ?? null,
    counterpartyName: t.counterparty_name ?? null,
    counterpartyBank: t.counterparty_bank ?? null,
    debit: BigInt(t.debit || 0),
    credit: BigInt(t.credit || 0),
    note: t.note ?? null,
    status: t.status,
    version: t.version ?? 1,
  }));

  // Hitung saldo berjalan secara murni
  const { rows, summary } = computePeriodLedger(openingBalance, entries);

  const kitchenMeta: SupabaseKitchenMeta = {
    id: k.id,
    code: k.code,
    name: k.name,
    pjName: k.pj_name,
    bankCode: bank?.bank_code || 'BCA',
    accountNoLast4: bank?.account_no_last4 || '0000',
    adminFeeDefault: BigInt(k.admin_fee_default || 6500),
    highAmountThreshold: BigInt(k.high_amount_threshold || 25000000),
    periodId: activePeriod.id,
    year: activePeriod.year,
    month: activePeriod.month,
    periodStatus: activePeriod.status as 'open' | 'locked',
    openingBalance,
    lastUploadDate: '-',
    pendingDraftCount: 0,
    needsManualCount: 0,
    summary,
  };

  return {
    kitchen: kitchenMeta,
    rows,
    summary,
  };
}

/**
 * Membuat dapur baru di Supabase:
 * Membuat atau menghubungkan organisasi, dapur, anggota (admin), rekening bank, dan periode awal.
 */
export async function createKitchen(
  supabase: SupabaseClient,
  userId: string,
  input: {
    name: string;
    code: string;
    pjName: string;
    bankCode: string;
    accountNo: string;
    openingBalance: bigint;
    adminFeeDefault?: bigint;
    year?: number;
    month?: number;
  },
): Promise<SupabaseKitchenMeta> {
  const adminClient = createAdminClient();

  // 1. Cari atau buat organisasi default untuk pengguna
  let orgId: string;
  const { data: existingOrgs } = await adminClient
    .from('organizations')
    .select('id')
    .limit(1);

  if (existingOrgs && existingOrgs.length > 0 && existingOrgs[0]?.id) {
    orgId = existingOrgs[0].id;
  } else {
    const { data: newOrg, error: orgErr } = await adminClient
      .from('organizations')
      .insert({ name: 'Yayasan SPPG' })
      .select('id')
      .single();

    if (orgErr || !newOrg) {
      throw new HttpError(500, `Gagal membuat organisasi: ${orgErr?.message}`);
    }
    orgId = newOrg.id;
  }

  const kitchenId = crypto.randomUUID();
  const periodId = crypto.randomUUID();
  const year = input.year ?? new Date().getFullYear();
  const month = input.month ?? new Date().getMonth() + 1;
  const openingBalance = input.openingBalance;
  const adminFeeDefault = input.adminFeeDefault ?? 6500n;
  const normalizedCode = input.code.trim().toUpperCase();

  // 2. Buat Dapur
  const { error: kErr } = await adminClient.from('kitchens').insert({
    id: kitchenId,
    organization_id: orgId,
    name: input.name.trim(),
    code: normalizedCode,
    pj_name: input.pjName.trim(),
    admin_fee_default: Number(adminFeeDefault),
    high_amount_threshold: 25000000,
    status: 'active',
  });

  if (kErr) {
    if (kErr.message?.includes('duplicate key') || kErr.message?.includes('unique')) {
      throw new HttpError(409, `Kode dapur ${normalizedCode} sudah digunakan.`);
    }
    throw new HttpError(500, `Gagal membuat dapur: ${kErr.message}`);
  }

  // 3. Daftarkan user pembuat sebagai 'admin' di dapur ini
  const { error: memErr } = await adminClient.from('kitchen_members').insert({
    kitchen_id: kitchenId,
    user_id: userId,
    role: 'admin',
  });

  if (memErr) {
    throw new HttpError(500, `Gagal mendaftarkan anggota dapur: ${memErr.message}`);
  }

  // 4. Daftarkan rekening bank
  const accountNoEnc = encryptField(input.accountNo);
  const accountNoHash = hashForLookup(input.accountNo);
  const accountNoLast4 = extractLast4Digits(input.accountNo);

  const { error: bankErr } = await adminClient.from('bank_accounts').insert({
    kitchen_id: kitchenId,
    bank_code: input.bankCode.trim().toUpperCase(),
    label: input.name.trim(),
    account_no_enc: accountNoEnc,
    account_no_hash: accountNoHash,
    account_no_last4: accountNoLast4,
    kind: 'operasional',
  });

  if (bankErr) {
    throw new HttpError(500, `Gagal mendaftarkan rekening bank: ${bankErr.message}`);
  }

  // 5. Buat periode buku kas awal
  const { error: pErr } = await adminClient.from('periods').insert({
    id: periodId,
    kitchen_id: kitchenId,
    year,
    month,
    opening_balance: Number(openingBalance),
    status: 'open',
  });

  if (pErr) {
    throw new HttpError(500, `Gagal membuat periode awal: ${pErr.message}`);
  }

  const summary: PeriodBalanceSummary = {
    openingBalance,
    totalIncoming: 0n,
    totalOutgoing: 0n,
    closingBalance: openingBalance,
    incomingCount: 0,
    outgoingCount: 0,
  };

  return {
    id: kitchenId,
    code: normalizedCode,
    name: input.name.trim(),
    pjName: input.pjName.trim(),
    bankCode: input.bankCode.trim().toUpperCase(),
    accountNoLast4,
    adminFeeDefault,
    highAmountThreshold: 25000000n,
    periodId,
    year,
    month,
    periodStatus: 'open',
    openingBalance,
    lastUploadDate: '-',
    pendingDraftCount: 0,
    needsManualCount: 0,
    summary,
  };
}

/**
 * Mencatat transaksi baru ke database Supabase.
 */
export async function createTransaction(
  supabase: SupabaseClient,
  userId: string,
  kitchenId: string,
  input: CreateTransactionInput,
): Promise<{ created: ComputedLedgerRow[]; summary: PeriodBalanceSummary }> {
  // Resolusi periode otomatis berdasarkan txDate (PRD E8: Periode ditentukan oleh tx_date)
  const targetPeriodId = await ensurePeriodForTxDate(
    supabase,
    kitchenId,
    input.txDate,
  );

  // 1. Ambil nomor seq_no berikutnya
  const { data: lastSeqRow } = await supabase
    .from('transactions')
    .select('seq_no')
    .eq('kitchen_id', kitchenId)
    .eq('period_id', targetPeriodId)
    .order('seq_no', { ascending: false })
    .limit(1);

  const nextSeq = (lastSeqRow?.[0]?.seq_no ?? 0) + 1;
  const mainTxId = crypto.randomUUID();
  const amountBig = BigInt(input.amount);

  if (amountBig <= 0n) {
    throw new HttpError(400, 'Nominal transaksi harus lebih besar dari Rp 0.');
  }
  if (amountBig > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new HttpError(400, 'Nominal transaksi melebihi batas bilangan bulat aman sistem.');
  }

  const debit = input.kind === 'incoming' ? Number(amountBig) : 0;
  const credit = input.kind === 'outgoing' ? Number(amountBig) : 0;

  interface InsertTxRow {
    id: string;
    kitchen_id: string;
    period_id: string;
    parent_transaction_id?: string | null;
    seq_no: number;
    tx_date: string;
    kind: 'incoming' | 'outgoing' | 'admin_fee';
    reference_no: string | null;
    description: string;
    counterparty_name: string | null;
    counterparty_bank: string | null;
    counterparty_account_last4: string | null;
    debit: number;
    credit: number;
    note: string | null;
    status: 'posted';
    version: number;
    created_by: string;
  }

  const rowsToInsert: InsertTxRow[] = [
    {
      id: mainTxId,
      kitchen_id: kitchenId,
      period_id: targetPeriodId,
      parent_transaction_id: null,
      seq_no: nextSeq,
      tx_date: input.txDate,
      kind: input.kind,
      reference_no: input.referenceNo || null,
      description: input.description.trim(),
      counterparty_name: input.counterpartyName || null,
      counterparty_bank: input.counterpartyBank || null,
      counterparty_account_last4: input.counterpartyAccount ? extractLast4Digits(input.counterpartyAccount) : null,
      debit,
      credit,
      note: input.note || null,
      status: 'posted',
      version: 1,
      created_by: userId,
    },
  ];

  // Jika menyertakan biaya admin bank otomatis
  if (input.includeAdminFee && input.adminFeeAmount) {
    const feeBig = BigInt(input.adminFeeAmount);
    if (feeBig > 0n) {
      rowsToInsert.push({
        id: crypto.randomUUID(),
        kitchen_id: kitchenId,
        period_id: targetPeriodId,
        parent_transaction_id: mainTxId,
        seq_no: nextSeq + 1,
        tx_date: input.txDate,
        kind: 'admin_fee',
        reference_no: input.referenceNo || null,
        description: `BIAYA ADMIN BANK - ${input.description.trim()}`,
        counterparty_name: null,
        counterparty_bank: input.counterpartyBank || null,
        counterparty_account_last4: null,
        debit: 0,
        credit: Number(feeBig),
        note: null,
        status: 'posted',
        version: 1,
        created_by: userId,
      });
    }
  }

  const { error: insErr } = await supabase.from('transactions').insert(rowsToInsert);
  if (insErr) {
    if (insErr.message?.includes('idx_transactions_unique_ref_kind')) {
      throw new HttpError(
        409,
        `Nomor referensi ${input.referenceNo} sudah digunakan pada transaksi aktif lain.`,
      );
    }
    throw new HttpError(500, `Gagal menyimpan transaksi: ${insErr.message}`);
  }

  // Ambil buku kas termutakhir
  const ledger = await getKitchenLedger(supabase, kitchenId, targetPeriodId);
  const createdRows = ledger.rows.filter(
    (r) => r.id === mainTxId || r.parentTransactionId === mainTxId,
  );

  return {
    created: createdRows,
    summary: ledger.summary,
  };
}

/**
 * Membatalkan transaksi (void) di Supabase.
 */
export async function voidTransaction(
  supabase: SupabaseClient,
  userId: string,
  kitchenId: string,
  txId: string,
  reason: string,
): Promise<{ voidedIds: string[] }> {
  // Ambil transaksi untuk memverifikasi versi
  const { data: tx, error: fetchErr } = await supabase
    .from('transactions')
    .select('id, note, status, version')
    .eq('id', txId)
    .eq('kitchen_id', kitchenId)
    .single();

  if (fetchErr || !tx) {
    throw new HttpError(404, 'Transaksi tidak ditemukan.');
  }

  if (tx.status === 'void') {
    throw new HttpError(400, 'Transaksi sudah dalam status dibatalkan (void).');
  }

  const noteAddition = reason ? ` [Batal: ${reason}]` : ' [Dibatalkan]';
  const updatedNote = (tx.note || '') + noteAddition;

  // Batalkan transaksi utama
  const { error: voidErr } = await supabase
    .from('transactions')
    .update({
      status: 'void',
      note: updatedNote,
      version: (tx.version || 1) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', txId);

  if (voidErr) {
    throw new HttpError(500, `Gagal membatalkan transaksi: ${voidErr.message}`);
  }

  const voidedIds = [txId];

  // Batalkan transaksi pasangan (admin fee) jika ada
  const { data: childTxs } = await supabase
    .from('transactions')
    .select('id')
    .eq('parent_transaction_id', txId)
    .eq('kitchen_id', kitchenId);

  if (childTxs && childTxs.length > 0) {
    const childIds = childTxs.map((c) => c.id);
    await supabase
      .from('transactions')
      .update({
        status: 'void',
        note: `[Batal bersama transaksi induk]`,
        updated_at: new Date().toISOString(),
      })
      .in('id', childIds);

    voidedIds.push(...childIds);
  }

  return { voidedIds };
}

/**
 * Memperbarui transaksi yang ada di database Supabase dengan optimistic locking (version).
 */
export async function updateTransaction(
  supabase: SupabaseClient,
  userId: string,
  kitchenId: string,
  txId: string,
  input: {
    version: number;
    txDate?: string;
    referenceNo?: string | null;
    description?: string;
    amount?: bigint;
    counterpartyAccount?: string | null;
    counterpartyName?: string | null;
    counterpartyBank?: string | null;
    note?: string | null;
  },
): Promise<{ updated: ComputedLedgerRow; summary: PeriodBalanceSummary }> {
  // 1. Ambil transaksi saat ini untuk verifikasi versi dan status
  const { data: existing, error: fetchErr } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', txId)
    .eq('kitchen_id', kitchenId)
    .single();

  if (fetchErr || !existing) {
    throw new HttpError(404, 'Transaksi tidak ditemukan.');
  }

  if (existing.status === 'void') {
    throw new HttpError(409, 'Transaksi yang sudah dibatalkan tidak dapat diedit.');
  }

  if (existing.version !== input.version) {
    throw new HttpError(
      409,
      'Konflik perubahan: transaksi ini telah diubah oleh sesi lain. Muat ulang halaman lalu coba kembali.',
    );
  }

  // 2. Periksa apakah periode masih terbuka
  const { data: periodRow } = await supabase
    .from('periods')
    .select('status')
    .eq('id', existing.period_id)
    .single();

  if (periodRow?.status === 'locked') {
    throw new HttpError(
      409,
      'Transaksi tidak dapat diubah karena periode buku kas sudah dikunci.',
    );
  }

  const updates: Record<string, unknown> = {
    version: existing.version + 1,
    updated_at: new Date().toISOString(),
  };

  if (input.txDate) updates.tx_date = input.txDate;
  if (input.referenceNo !== undefined) updates.reference_no = input.referenceNo;
  if (input.description) updates.description = input.description.trim();
  if (input.note !== undefined) updates.note = input.note;
  if (input.counterpartyName !== undefined) updates.counterparty_name = input.counterpartyName;
  if (input.counterpartyBank !== undefined) updates.counterparty_bank = input.counterpartyBank;
  if (input.counterpartyAccount !== undefined) {
    updates.counterparty_account_last4 = input.counterpartyAccount
      ? extractLast4Digits(input.counterpartyAccount)
      : null;
  }

  if (input.amount !== undefined) {
    const amountBig = BigInt(input.amount);
    if (amountBig <= 0n) {
      throw new HttpError(400, 'Nominal transaksi harus lebih besar dari Rp 0.');
    }
    if (amountBig > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new HttpError(400, 'Nominal transaksi melebihi batas bilangan bulat aman sistem.');
    }
    const amountNum = Number(amountBig);
    if (existing.kind === 'incoming') {
      updates.debit = amountNum;
      updates.credit = 0;
    } else {
      updates.debit = 0;
      updates.credit = amountNum;
    }
  }

  const { error: updateErr } = await supabase
    .from('transactions')
    .update(updates)
    .eq('id', txId);

  if (updateErr) {
    if (updateErr.message?.includes('unique') || updateErr.message?.includes('duplicate')) {
      throw new HttpError(
        409,
        `Nomor referensi ${input.referenceNo} sudah digunakan pada transaksi lain.`,
      );
    }
    throw new HttpError(500, `Gagal memperbarui transaksi: ${updateErr.message}`);
  }

  // Jika ini transaksi induk outgoing, perbarui juga tx_date dan reference_no pada transaksi pasangan admin_fee
  if (existing.kind === 'outgoing') {
    const pairedUpdates: Record<string, unknown> = {};
    if (input.txDate) pairedUpdates.tx_date = input.txDate;
    if (input.referenceNo !== undefined) pairedUpdates.reference_no = input.referenceNo;

    if (Object.keys(pairedUpdates).length > 0) {
      await supabase
        .from('transactions')
        .update(pairedUpdates)
        .eq('parent_transaction_id', txId)
        .eq('kitchen_id', kitchenId);
    }
  }

  const ledger = await getKitchenLedger(supabase, kitchenId, existing.period_id);
  const updatedRow = ledger.rows.find((r) => r.id === txId);
  if (!updatedRow) {
    throw new HttpError(500, 'Gagal memuat ulang data transaksi setelah diperbarui.');
  }

  return {
    updated: updatedRow,
    summary: ledger.summary,
  };
}

/**
 * Mengunci periode berjalan di database Supabase (PRD FR-F8.1, SECURITY S-15).
 */
export async function lockPeriod(
  supabase: SupabaseClient,
  userId: string,
  kitchenId: string,
  periodId: string,
  input?: { forceWithUnpostedDrafts?: boolean },
): Promise<{
  periodId: string;
  status: 'locked';
  nextPeriodOpeningBalance: bigint;
  summary: PeriodBalanceSummary;
}> {
  const { data: periodRow, error: pErr } = await supabase
    .from('periods')
    .select('*')
    .eq('id', periodId)
    .eq('kitchen_id', kitchenId)
    .single();

  if (pErr || !periodRow) {
    throw new HttpError(404, 'Periode tidak ditemukan pada dapur ini.');
  }

  if (periodRow.status === 'locked') {
    throw new HttpError(409, 'Periode sudah dalam keadaan terkunci.');
  }

  // Cek apakah ada bukti transfer yang belum diposting
  const { data: unpostedUploads } = await supabase
    .from('uploads')
    .select('id')
    .eq('kitchen_id', kitchenId)
    .in('status', ['uploaded', 'parsed', 'needs_manual']);

  const unpostedCount = unpostedUploads?.length ?? 0;
  if (unpostedCount > 0 && !input?.forceWithUnpostedDrafts) {
    throw new HttpError(
      400,
      `Terdapat ${unpostedCount} draf bukti transfer yang belum diposting. Selesaikan atau periksa draf terlebih dahulu sebelum mengunci periode.`,
    );
  }

  const ledger = await getKitchenLedger(supabase, kitchenId, periodId);

  const { error: lockErr } = await supabase
    .from('periods')
    .update({
      status: 'locked',
      locked_at: new Date().toISOString(),
      locked_by: userId,
    })
    .eq('id', periodId);

  if (lockErr) {
    throw new HttpError(500, `Gagal mengunci periode: ${lockErr.message}`);
  }

  return {
    periodId,
    status: 'locked',
    nextPeriodOpeningBalance: ledger.summary.closingBalance,
    summary: ledger.summary,
  };
}

/**
 * Membuka kembali periode terkunci di database Supabase (PRD FR-F8.3).
 */
export async function unlockPeriod(
  supabase: SupabaseClient,
  userId: string,
  kitchenId: string,
  periodId: string,
  input: { reason: string },
  userRole: string = 'admin',
): Promise<{ periodId: string; status: 'open' }> {
  if (userRole !== 'admin') {
    throw new HttpError(403, 'Hanya admin dapur yang berwenang membuka kembali periode terkunci.');
  }

  if (!input.reason || input.reason.trim().length < 5) {
    throw new HttpError(400, 'Alasan pembukaan kembali periode wajib diisi (minimal 5 karakter).');
  }

  const { data: periodRow, error: pErr } = await supabase
    .from('periods')
    .select('*')
    .eq('id', periodId)
    .eq('kitchen_id', kitchenId)
    .single();

  if (pErr || !periodRow) {
    throw new HttpError(404, 'Periode tidak ditemukan pada dapur ini.');
  }

  if (periodRow.status !== 'locked') {
    throw new HttpError(400, 'Periode tidak dalam keadaan terkunci.');
  }

  const { error: unlockErr } = await supabase
    .from('periods')
    .update({
      status: 'open',
      reopen_reason: input.reason.trim(),
      locked_at: null,
      locked_by: null,
    })
    .eq('id', periodId);

  if (unlockErr) {
    throw new HttpError(500, `Gagal membuka kembali periode: ${unlockErr.message}`);
  }

  return {
    periodId,
    status: 'open',
  };
}

/**
 * Membuka periode baru secara otomatis dari saldo akhir periode yang terkunci di Supabase (PRD FR-F8.2).
 */
export async function transitionToNextPeriod(
  supabase: SupabaseClient,
  userId: string,
  kitchenId: string,
): Promise<{
  periodId: string;
  year: number;
  month: number;
  openingBalance: bigint;
  status: 'open';
}> {
  const { data: activePeriods, error: pErr } = await supabase
    .from('periods')
    .select('*')
    .eq('kitchen_id', kitchenId)
    .order('year', { ascending: false })
    .order('month', { ascending: false })
    .limit(1);

  const activePeriod = activePeriods?.[0];
  if (pErr || !activePeriod) {
    throw new HttpError(404, 'Periode tidak ditemukan.');
  }

  if (activePeriod.status !== 'locked') {
    throw new HttpError(
      400,
      'Periode saat ini harus dikunci terlebih dahulu sebelum melanjutkan ke periode berikutnya.',
    );
  }

  let nextMonth = activePeriod.month + 1;
  let nextYear = activePeriod.year;
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear += 1;
  }

  const ledger = await getKitchenLedger(supabase, kitchenId, activePeriod.id);
  const nextOpeningBalance = ledger.summary.closingBalance;
  const newPeriodId = crypto.randomUUID();

  const { error: insErr } = await supabase.from('periods').insert({
    id: newPeriodId,
    kitchen_id: kitchenId,
    year: nextYear,
    month: nextMonth,
    opening_balance: Number(nextOpeningBalance),
    status: 'open',
  });

  if (insErr) {
    if (insErr.message?.includes('duplicate key') || insErr.message?.includes('unique')) {
      throw new HttpError(409, `Periode ${nextMonth}/${nextYear} sudah ada.`);
    }
    throw new HttpError(500, `Gagal membuat periode baru: ${insErr.message}`);
  }

  return {
    periodId: newPeriodId,
    year: nextYear,
    month: nextMonth,
    openingBalance: nextOpeningBalance,
    status: 'open',
  };
}

export interface SupabaseAuditRecord {
  id: string;
  kitchenId: string;
  actorId: string;
  action: string;
  entity: string;
  entityId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown>;
  createdAt: string;
}

/**
 * Mengambil jejak audit dari tabel public.audit_logs di Supabase.
 */
export async function getKitchenAuditLogs(
  supabase: SupabaseClient,
  kitchenId: string,
): Promise<readonly SupabaseAuditRecord[]> {
  const { data: rows, error } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('kitchen_id', kitchenId)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error || !rows) {
    return [];
  }

  return rows.map((r) => ({
    id: r.id,
    kitchenId: r.kitchen_id,
    actorId: r.actor_id || 'system',
    action: r.action,
    entity: r.entity,
    entityId: r.entity_id,
    before: r.before as Record<string, unknown> | null,
    after: (r.after as Record<string, unknown>) || {},
    createdAt: r.created_at,
  }));
}

function mapDbUploadToRecord(row: Record<string, unknown>): UploadRecord {
  const pr = (row.parse_result as Record<string, unknown>) || {};
  return {
    id: row.id as string,
    kitchenId: row.kitchen_id as string,
    periodId: (row.period_id as string) || '',
    storagePath: row.storage_path as string,
    originalName: row.original_name as string,
    mime: row.mime as 'application/pdf' | 'image/jpeg' | 'image/png',
    sizeBytes: Number(row.size_bytes),
    sha256: row.sha256 as string,
    status: row.status as 'parsed' | 'needs_manual' | 'failed' | 'posted',
    parserUsed: (row.parser_used as 'ai' | 'manual' | 'rate_limited') || 'ai',
    txDate: (pr.txDate as string) ?? null,
    referenceNo: (pr.referenceNo as string) ?? null,
    amount: (pr.amount as string) ?? null,
    senderAccount: (pr.senderAccount as string) ?? null,
    recipientAccount: (pr.recipientAccount as string) ?? null,
    recipientName: (pr.recipientName as string) ?? null,
    recipientBank: (pr.recipientBank as string) ?? null,
    memo: (pr.memo as string) ?? null,
    suggestedDescription: (pr.suggestedDescription as string) ?? null,
    matchedRuleId: (pr.matchedRuleId as string) ?? null,
    suggestedKitchenId:
      (row.suggested_kitchen_id as string) || (pr.suggestedKitchenId as string) || null,
    suggestedKitchenName: (pr.suggestedKitchenName as string) ?? null,
    wrongKitchenWarning: (pr.wrongKitchenWarning as string) ?? null,
    suggestedIncludeAdminFee: Boolean(pr.suggestedIncludeAdminFee),
    suggestedAdminFeeAmount: (pr.suggestedAdminFeeAmount as string) ?? '6500',
    consistencyFlags:
      (row.consistency_flags as string[]) || (pr.consistencyFlags as string[]) || [],
    consistencyReasons:
      (pr.consistencyReasons as Array<{ code: string; message: string }>) || [],
    lowConfidenceFields: (pr.lowConfidenceFields as string[]) || [],
    confidence: (pr.confidence as Record<string, number>) || {},
    fallbackReason: (pr.fallbackReason as string) ?? null,
    postedTransactionId: (pr.postedTransactionId as string) ?? null,
    uploadedBy: row.uploaded_by as string,
    createdAt: row.created_at as string,
  };
}

/**
 * Mengambil daftar bukti transfer dari tabel public.uploads Supabase.
 */
export async function listSupabaseUploads(
  supabase: SupabaseClient,
  kitchenId: string,
  statusFilter: 'all' | 'reviewable' | 'parsed' | 'needs_manual' | 'posted' = 'all',
): Promise<UploadRecord[]> {
  let query = supabase
    .from('uploads')
    .select('*')
    .eq('kitchen_id', kitchenId)
    .order('created_at', { ascending: false });

  if (statusFilter === 'reviewable') {
    query = query.in('status', ['parsed', 'needs_manual', 'uploaded']);
  } else if (statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
  }

  const { data: rows, error } = await query;
  if (error || !rows) {
    return [];
  }

  return rows.map((r) => mapDbUploadToRecord(r as Record<string, unknown>));
}

/**
 * Memproses unggahan bukti transfer ke Supabase (Storage + Database public.uploads).
 */
export async function processBatchUploadToSupabase(
  supabase: SupabaseClient,
  kitchenId: string,
  userId: string,
  files: readonly { name: string; bytes: Uint8Array }[],
): Promise<UploadRecord[]> {
  if (files.length === 0) {
    throw new HttpError(422, 'Pilih minimal 1 berkas bukti transfer.');
  }
  if (files.length > MAX_BATCH_FILES) {
    throw new HttpError(422, `Maksimal ${MAX_BATCH_FILES} berkas per unggahan.`);
  }

  const ledgerData = await getKitchenLedger(supabase, kitchenId);
  const kitchenMeta = ledgerData.kitchen;
  const existingRefs = new Set<string>(
    ledgerData.rows
      .filter((r) => r.status !== 'void' && r.referenceNo !== null)
      .map((r) => r.referenceNo!),
  );

  const results: UploadRecord[] = [];

  for (const fileItem of files) {
    const normalized: NormalizedUploadFile =
      await validateAndNormalizeTransferProofBytes(
        fileItem.bytes,
        fileItem.name,
        kitchenId,
      );

    // Cek duplikat SHA-256 pada database Supabase (PRD E6)
    const { data: existingDup } = await supabase
      .from('uploads')
      .select('id, status, parse_result')
      .eq('kitchen_id', kitchenId)
      .eq('sha256', normalized.sha256)
      .neq('status', 'failed')
      .maybeSingle();

    if (existingDup) {
      const ref = (existingDup.parse_result as Record<string, unknown>)?.referenceNo;
      const refInfo = ref ? `, referensi ${ref}` : '';
      throw new HttpError(
        409,
        `Berkas "${normalized.displayName}" sudah pernah diunggah di dapur ini (ID unggahan: ${existingDup.id}${refInfo}).`,
      );
    }

    // Unggah ke Supabase Storage bucket 'uploads'
    try {
      const admin = createAdminClient();
      await admin.storage.createBucket('uploads', { public: false }).catch(() => {});
      await admin.storage
        .from('uploads')
        .upload(normalized.storagePath, normalized.bytes, {
          contentType: normalized.mediaType,
          upsert: true,
        });
    } catch {
      try {
        await supabase.storage
          .from('uploads')
          .upload(normalized.storagePath, normalized.bytes, {
            contentType: normalized.mediaType,
            upsert: true,
          });
      } catch {
        // Storage upload non-fatal bila bucket belum dibuat di dashboard
      }
    }
    // Simpan juga di memory cache agar pratinjau selalu dapat diakses seketika
    defaultUploadStore.saveFileBytes(normalized.storagePath, normalized.bytes);

    const env = getExtractionEnv();
    let extracted: Extracted | null = null;
    let parserUsed: 'ai' | 'manual' | 'rate_limited' = 'ai';
    let fallbackReason: string | null = null;

    if (env.EXTRACTION_MODE === 'manual') {
      parserUsed = 'manual';
      fallbackReason = 'Mode ekstraksi manual aktif. Silakan isi formulir secara manual.';
    } else {
      // 0. Cek apakah dokumen merupakan laporan transaksi banyak (misal BNI Direct PDF)
      if (normalized.mediaType === 'application/pdf') {
        try {
          const multiRows = await detectAndParseMultiTrxPdf(normalized.bytes);
          if (multiRows.length > 0) {
            for (let mIdx = 0; mIdx < multiRows.length; mIdx++) {
              const mRow = multiRows[mIdx]!;
              const mUploadId = crypto.randomUUID();
              const isDiffBank =
                mRow.isOnlineTransfer &&
                mRow.recipientBank.trim().toUpperCase() !==
                  kitchenMeta.bankCode.trim().toUpperCase();

              const parseResultObj = {
                txDate: mRow.txDate,
                referenceNo: mRow.referenceNo,
                amount: mRow.amount,
                senderAccount: null,
                recipientAccount: mRow.recipientAccount || null,
                recipientName: mRow.recipientName,
                recipientBank: mRow.recipientBank,
                memo: mRow.service,
                suggestedDescription: `${mRow.recipientName} - ${mRow.service}`,
                matchedRuleId: null,
                suggestedKitchenId: kitchenId,
                suggestedKitchenName: kitchenMeta.name,
                wrongKitchenWarning: null,
                suggestedIncludeAdminFee: isDiffBank,
                suggestedAdminFeeAmount: isDiffBank
                  ? kitchenMeta.adminFeeDefault.toString()
                  : '0',
                consistencyFlags: [],
                consistencyReasons: [],
                lowConfidenceFields: [],
                confidence: { txDate: 1.0, referenceNo: 1.0, amount: 1.0 },
                fallbackReason: null,
                postedTransactionId: null,
              };

              await supabase.from('uploads').insert({
                id: mUploadId,
                kitchen_id: kitchenId,
                period_id: kitchenMeta.periodId,
                storage_path: normalized.storagePath,
                original_name: `${normalized.displayName} (#${mIdx + 1} - ${mRow.recipientName})`,
                mime: normalized.mediaType,
                size_bytes: normalized.bytes.byteLength,
                sha256: `${normalized.sha256}_${mIdx}`,
                status: 'parsed',
                parser_used: 'ai',
                parse_result: parseResultObj,
                consistency_flags: [],
                uploaded_by: userId,
              });

              results.push({
                id: mUploadId,
                kitchenId,
                periodId: kitchenMeta.periodId,
                storagePath: normalized.storagePath,
                originalName: `${normalized.displayName} (#${mIdx + 1} - ${mRow.recipientName})`,
                mime: normalized.mediaType,
                sizeBytes: normalized.bytes.byteLength,
                sha256: `${normalized.sha256}_${mIdx}`,
                status: 'parsed',
                parserUsed: 'ai',
                txDate: mRow.txDate,
                referenceNo: mRow.referenceNo,
                amount: mRow.amount,
                senderAccount: null,
                recipientAccount: mRow.recipientAccount || null,
                recipientName: mRow.recipientName,
                recipientBank: mRow.recipientBank,
                memo: mRow.service,
                suggestedDescription: `${mRow.recipientName} - ${mRow.service}`,
                matchedRuleId: null,
                suggestedKitchenId: kitchenId,
                suggestedKitchenName: kitchenMeta.name,
                wrongKitchenWarning: null,
                suggestedIncludeAdminFee: isDiffBank,
                suggestedAdminFeeAmount: isDiffBank
                  ? kitchenMeta.adminFeeDefault.toString()
                  : '0',
                consistencyFlags: [],
                consistencyReasons: [],
                lowConfidenceFields: [],
                confidence: { txDate: 1.0, referenceNo: 1.0, amount: 1.0 },
                fallbackReason: null,
                postedTransactionId: null,
                uploadedBy: userId,
                createdAt: new Date().toISOString(),
              });
            }
            continue;
          }
        } catch {
          // Lanjut ke single-receipt parser jika gagal
        }
      }

      // 1. Ekstraksi deterministik lokal jika berkas PDF memuat teks transaksi tunggal
      if (normalized.mediaType === 'application/pdf') {
        try {
          const pdfPayload = await extractPayloadFromPdf(normalized.bytes);
          if (pdfPayload.text && pdfPayload.text.trim().length > 10) {
            const localExtracted = parseReceiptText(pdfPayload.text);
            if (localExtracted && localExtracted.txDate && localExtracted.amount) {
              extracted = localExtracted;
              parserUsed = 'ai';
            }
          }
        } catch {
          // Lanjut ke pemanggilan AI vision
        }
      }

      // 2. Jika belum terbaca, panggil aiExtract
      if (!extracted || !extracted.txDate || !extracted.amount) {
        const rateCheck = await extractLimiter.limit(`extract:${userId}`);
        if (!rateCheck.success) {
          parserUsed = 'rate_limited';
          fallbackReason = 'Batas laju ekstraksi tercapai. Silakan isi formulir secara manual.';
        } else {
          try {
            const aiResult = await aiExtract({
              mediaType: normalized.mediaType,
              base64: Buffer.from(normalized.bytes).toString('base64'),
            });
            if (aiResult) {
              extracted = aiResult;
            }
          } catch {
            extracted = null;
          }
          if (!extracted) {
            fallbackReason =
              'Penyedia AI tidak merespons atau berkas tidak terbaca. Silakan lengkapi formulir review secara manual.';
          }
        }
      }
    }

    const isNeedsManual = shouldFallbackToNeedsManual(extracted);
    const status: 'parsed' | 'needs_manual' = isNeedsManual ? 'needs_manual' : 'parsed';
    if (isNeedsManual && !fallbackReason) {
      fallbackReason =
        'Nominal atau tanggal bukti transfer tidak terbaca dengan yakin. Silakan lengkapi secara manual.';
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const flags = extracted
      ? consistencyFlags(extracted, {
          today: todayStr,
          amountThreshold: kitchenMeta.highAmountThreshold,
          existingReferenceNos: existingRefs,
        })
      : ['nominal_tidak_valid'];

    const reasons = flags.map((code) => ({
      code,
      message:
        CONSISTENCY_FLAG_DESCRIPTIONS[code] ??
        `Periksa kembali field terkait (${code}).`,
    }));

    const lowConfidenceFields = extracted
      ? getLowConfidenceFields(extracted.confidence)
      : ['txDate', 'referenceNo', 'amount'];

    // Usulan deskripsi dari counterparty_rules di database Supabase
    let suggestedDescription: string | null = extracted?.memo ?? null;
    let matchedRuleId: string | null = null;

    if (extracted?.recipientAccount) {
      try {
        const cleanDigits = extracted.recipientAccount.replace(/\D/g, '');
        if (cleanDigits.length >= 4) {
          const accHash = hashForLookup(cleanDigits);
          const { data: matchedRule } = await supabase
            .from('counterparty_rules')
            .select('*')
            .eq('match_account_no_hash', accHash)
            .maybeSingle();

          if (matchedRule?.description_template) {
            suggestedDescription = matchedRule.description_template;
            matchedRuleId = matchedRule.id;
          }
        }
      } catch {
        // Abaikan
      }
    }

    const recipientBank = extracted?.recipientBank ?? null;
    const suggestedIncludeAdminFee = Boolean(
      recipientBank &&
        recipientBank.trim().toUpperCase() !== kitchenMeta.bankCode.trim().toUpperCase(),
    );

    const uploadId = crypto.randomUUID();
    const parseResultObj = {
      txDate: extracted?.txDate ?? null,
      referenceNo: extracted?.referenceNo ?? null,
      amount: extracted?.amount ?? null,
      senderAccount: extracted?.senderAccount ?? null,
      recipientAccount: extracted?.recipientAccount ?? null,
      recipientName: extracted?.recipientName ?? null,
      recipientBank,
      memo: extracted?.memo ?? null,
      suggestedDescription,
      matchedRuleId,
      suggestedKitchenId: kitchenId,
      suggestedKitchenName: kitchenMeta.name,
      wrongKitchenWarning: null,
      suggestedIncludeAdminFee,
      suggestedAdminFeeAmount: kitchenMeta.adminFeeDefault.toString(),
      consistencyFlags: flags,
      consistencyReasons: reasons,
      lowConfidenceFields,
      confidence: extracted?.confidence ?? {},
      fallbackReason,
      postedTransactionId: null,
    };

    const { error: insErr } = await supabase.from('uploads').insert({
      id: uploadId,
      kitchen_id: kitchenId,
      period_id: kitchenMeta.periodId,
      storage_path: normalized.storagePath,
      original_name: normalized.displayName,
      mime: normalized.mediaType,
      size_bytes: normalized.bytes.byteLength,
      sha256: normalized.sha256,
      status,
      parser_used: parserUsed,
      parse_result: parseResultObj,
      consistency_flags: flags,
      uploaded_by: userId,
    });

    if (insErr) {
      throw new HttpError(
        500,
        `Gagal menyimpan bukti transfer ke database: ${insErr.message}`,
      );
    }

    const record: UploadRecord = {
      id: uploadId,
      kitchenId,
      periodId: kitchenMeta.periodId,
      storagePath: normalized.storagePath,
      originalName: normalized.displayName,
      mime: normalized.mediaType,
      sizeBytes: normalized.bytes.byteLength,
      sha256: normalized.sha256,
      status,
      parserUsed,
      txDate: parseResultObj.txDate,
      referenceNo: parseResultObj.referenceNo,
      amount: parseResultObj.amount,
      senderAccount: parseResultObj.senderAccount,
      recipientAccount: parseResultObj.recipientAccount,
      recipientName: parseResultObj.recipientName,
      recipientBank: parseResultObj.recipientBank,
      memo: parseResultObj.memo,
      suggestedDescription,
      matchedRuleId,
      suggestedKitchenId: kitchenId,
      suggestedKitchenName: kitchenMeta.name,
      wrongKitchenWarning: null,
      suggestedIncludeAdminFee,
      suggestedAdminFeeAmount: kitchenMeta.adminFeeDefault.toString(),
      consistencyFlags: flags,
      consistencyReasons: reasons,
      lowConfidenceFields,
      confidence: parseResultObj.confidence,
      fallbackReason,
      postedTransactionId: null,
      uploadedBy: userId,
      createdAt: new Date().toISOString(),
    };

    results.push(record);

    logger.info(
      {
        uploadId,
        kitchenId,
        mime: record.mime,
        sizeBytes: record.sizeBytes,
        status: record.status,
        parserUsed: record.parserUsed,
      },
      'upload_processed_supabase',
    );
  }

  return results;
}

/**
 * Mengambil byte berkas bukti transfer dari Supabase Storage.
 */
export async function getSupabaseUploadFileBytes(
  supabase: SupabaseClient,
  kitchenId: string,
  uploadId: string,
): Promise<{ bytes: Uint8Array; mime: string; displayName: string }> {
  const { data: uploadRow, error } = await supabase
    .from('uploads')
    .select('*')
    .eq('id', uploadId)
    .eq('kitchen_id', kitchenId)
    .single();

  if (error || !uploadRow) {
    throw new HttpError(404, 'Berkas unggahan tidak ditemukan.');
  }

  // 1. Cek memory cache lokal
  const cached = defaultUploadStore.getCachedFileBytes(uploadRow.storage_path);
  if (cached) {
    return {
      bytes: cached,
      mime: uploadRow.mime,
      displayName: uploadRow.original_name,
    };
  }

  // 2. Unduh dari Supabase Storage (coba admin client dulu, lalu client pengguna)
  try {
    const admin = createAdminClient();
    const { data: fileData, error: dlErr } = await admin.storage
      .from('uploads')
      .download(uploadRow.storage_path);

    if (!dlErr && fileData) {
      const buf = await fileData.arrayBuffer();
      const arr = new Uint8Array(buf);
      defaultUploadStore.saveFileBytes(uploadRow.storage_path, arr);
      return {
        bytes: arr,
        mime: uploadRow.mime,
        displayName: uploadRow.original_name,
      };
    }
  } catch {
    // Abaikan
  }

  try {
    const { data: fileData, error: dlErr } = await supabase.storage
      .from('uploads')
      .download(uploadRow.storage_path);

    if (!dlErr && fileData) {
      const buf = await fileData.arrayBuffer();
      const arr = new Uint8Array(buf);
      defaultUploadStore.saveFileBytes(uploadRow.storage_path, arr);
      return {
        bytes: arr,
        mime: uploadRow.mime,
        displayName: uploadRow.original_name,
      };
    }
  } catch {
    // Abaikan
  }

  return defaultUploadStore.getUploadFileBytes(kitchenId, uploadId);
}

/**
 * Memposting bukti transfer ke buku kas Supabase setelah direview pengguna.
 */
export async function postSupabaseReviewedUpload(
  supabase: SupabaseClient,
  kitchenId: string,
  uploadId: string,
  userId: string,
  input: PostUploadReviewInput,
): Promise<{
  upload: UploadRecord;
  createdTransactions: ComputedLedgerRow[];
  summary: PeriodBalanceSummary;
  savedRule: CounterpartyRuleRecord | null;
}> {
  const { data: uploadRow, error: fetchErr } = await supabase
    .from('uploads')
    .select('*')
    .eq('id', uploadId)
    .eq('kitchen_id', kitchenId)
    .single();

  if (fetchErr || !uploadRow) {
    throw new HttpError(404, 'Bukti transfer tidak ditemukan.');
  }

  if (uploadRow.status === 'posted') {
    throw new HttpError(409, 'Bukti transfer ini sudah pernah diposting ke buku kas.');
  }

  const pr = (uploadRow.parse_result as Record<string, unknown>) || {};
  if (pr.wrongKitchenWarning && !input.confirmWrongKitchen) {
    throw new HttpError(
      422,
      `${pr.wrongKitchenWarning} Centang konfirmasi bahwa Anda yakin ingin memposting ke dapur ini.`,
    );
  }

  const finalRecipientName = input.isPayrollMassal
    ? input.counterpartyName?.trim() || 'Rekening Masing-Masing Relawan'
    : (input.counterpartyName ?? null);

  const { created, summary } = await createTransaction(supabase, userId, kitchenId, {
    periodId: input.periodId ?? uploadRow.period_id,
    txDate: input.txDate,
    kind: input.kind ?? 'outgoing',
    referenceNo: input.referenceNo ?? null,
    description: input.description,
    amount: input.amount,
    counterpartyAccount: input.counterpartyAccount ?? null,
    counterpartyName: finalRecipientName,
    counterpartyBank: input.counterpartyBank ?? null,
    note: input.note ?? null,
    includeAdminFee: input.includeAdminFee ?? false,
    adminFeeAmount: input.adminFeeAmount,
  });

  const mainCreatedId = created[0]?.id;
  if (mainCreatedId) {
    await supabase
      .from('transactions')
      .update({ source_upload_id: uploadId })
      .eq('id', mainCreatedId);
  }

  let savedRule: CounterpartyRuleRecord | null = null;
  const cleanRecipient = (input.counterpartyAccount || '').replace(/\D/g, '');
  if (input.saveCounterpartyRule && cleanRecipient.length >= 4) {
    try {
      const accountHash = hashForLookup(cleanRecipient);
      const { data: kRow } = await supabase
        .from('kitchens')
        .select('organization_id')
        .eq('id', kitchenId)
        .single();

      if (kRow?.organization_id) {
        const { data: insertedRule } = await supabase
          .from('counterparty_rules')
          .upsert(
            {
              organization_id: kRow.organization_id,
              match_account_no_hash: accountHash,
              counterparty_name: finalRecipientName,
              counterparty_bank: input.counterpartyBank || null,
              description_template: input.description.trim(),
              last_used_at: new Date().toISOString(),
            },
            { onConflict: 'organization_id,match_account_no_hash' },
          )
          .select()
          .maybeSingle();

        if (insertedRule) {
          savedRule = {
            id: insertedRule.id,
            organizationId: insertedRule.organization_id,
            matchAccountNoHash: insertedRule.match_account_no_hash,
            descriptionTemplate: insertedRule.description_template,
            timesUsed: insertedRule.times_used || 1,
            lastUsedAt: insertedRule.last_used_at,
          };
        }
      }
    } catch {
      // Aturan counterparty opsional
    }
  }

  const updatedPr = {
    ...pr,
    postedTransactionId: mainCreatedId || null,
  };

  await supabase
    .from('uploads')
    .update({
      status: 'posted',
      parse_result: updatedPr,
    })
    .eq('id', uploadId);

  uploadRow.status = 'posted';
  uploadRow.parse_result = updatedPr;

  return {
    upload: mapDbUploadToRecord(uploadRow as Record<string, unknown>),
    createdTransactions: created,
    summary,
    savedRule,
  };
}
