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

  // 2. Ambil data dapur, rekening bank, dan periode aktif
  const [kitchensRes, bankRes, periodsRes, uploadsRes] = await Promise.all([
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
  ]);

  const rawKitchens = kitchensRes.data || [];
  const rawBanks = bankRes.data || [];
  const rawPeriods = periodsRes.data || [];
  const rawUploads = uploadsRes.data || [];

  const results: SupabaseKitchenMeta[] = [];

  for (const k of rawKitchens) {
    const bank = rawBanks.find((b) => b.kitchen_id === k.id);
    const activePeriod = rawPeriods.find((p) => p.kitchen_id === k.id);

    const year = activePeriod?.year ?? new Date().getFullYear();
    const month = activePeriod?.month ?? new Date().getMonth() + 1;
    const periodId = activePeriod?.id ?? crypto.randomUUID();
    const periodStatus = (activePeriod?.status ?? 'open') as 'open' | 'locked';
    const openingBalance = activePeriod ? BigInt(activePeriod.opening_balance) : 0n;

    // Ambil transaksi untuk menghitung saldo berjalan
    let summary: PeriodBalanceSummary = {
      openingBalance,
      totalIncoming: 0n,
      totalOutgoing: 0n,
      closingBalance: openingBalance,
      incomingCount: 0,
      outgoingCount: 0,
    };

    if (activePeriod?.id) {
      const { data: txs } = await supabase
        .from('transactions')
        .select('*')
        .eq('kitchen_id', k.id)
        .eq('period_id', activePeriod.id)
        .eq('status', 'posted');

      if (txs && txs.length > 0) {
        let totalInc = 0n;
        let totalOut = 0n;
        let incCount = 0;
        let outCount = 0;
        for (const t of txs) {
          const deb = BigInt(t.debit || 0);
          const cred = BigInt(t.credit || 0);
          if (deb > 0n) incCount++;
          if (cred > 0n) outCount++;
          totalInc += deb;
          totalOut += cred;
        }
        summary = {
          openingBalance,
          totalIncoming: totalInc,
          totalOutgoing: totalOut,
          closingBalance: openingBalance + totalInc - totalOut,
          incomingCount: incCount,
          outgoingCount: outCount,
        };
      }
    }

    const kitchenUploads = rawUploads.filter((u) => u.kitchen_id === k.id);
    const pendingDraftCount = kitchenUploads.filter((u) => u.status === 'uploaded').length;
    const needsManualCount = kitchenUploads.filter((u) => u.status === 'needs_manual').length;

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
 * Mengambil buku kas satu dapur lengkap dengan baris transaksi dan ringkasan saldo.
 */
export async function getKitchenLedger(
  supabase: SupabaseClient,
  kitchenId: string,
  periodId?: string,
): Promise<SupabaseKitchenLedgerResult> {
  // 1. Ambil info dapur & rekening bank
  const [kitchenRes, bankRes] = await Promise.all([
    supabase.from('kitchens').select('*').eq('id', kitchenId).single(),
    supabase.from('bank_accounts').select('*').eq('kitchen_id', kitchenId).maybeSingle(),
  ]);

  if (kitchenRes.error || !kitchenRes.data) {
    throw new HttpError(404, 'Dapur tidak ditemukan.');
  }

  const k = kitchenRes.data;
  const bank = bankRes.data;

  // 2. Ambil periode
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

  const { data: periods, error: pErr } = await periodQuery;
  if (pErr) {
    throw new HttpError(500, `Gagal memuat periode: ${pErr.message}`);
  }
  const activePeriod = periods?.[0];

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
  let targetPeriodId: string = input.periodId ?? '';
  if (!targetPeriodId) {
    const { data: p } = await supabase
      .from('periods')
      .select('id')
      .eq('kitchen_id', kitchenId)
      .eq('status', 'open')
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!p || !p.id) {
      throw new HttpError(404, 'Periode aktif tidak ditemukan.');
    }
    targetPeriodId = p.id as string;
  }

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
  const debit = input.kind === 'incoming' ? Number(amountBig) : 0;
  const credit = input.kind === 'outgoing' ? Number(amountBig) : 0;

  interface InsertTxRow {
    id: string;
    kitchen_id: string;
    period_id: string;
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
  const ledger = await getKitchenLedger(supabase, kitchenId, input.periodId);
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
      await supabase.storage
        .from('uploads')
        .upload(normalized.storagePath, normalized.bytes, {
          contentType: normalized.mediaType,
          upsert: true,
        });
    } catch {
      // Storage upload non-fatal bila bucket belum dibuat di dashboard
    }

    const env = getExtractionEnv();
    let extracted: Extracted | null = null;
    let parserUsed: 'ai' | 'manual' | 'rate_limited' = 'ai';
    let fallbackReason: string | null = null;

    if (env.EXTRACTION_MODE === 'manual') {
      parserUsed = 'manual';
      fallbackReason = 'Mode ekstraksi manual aktif. Silakan isi formulir secara manual.';
    } else {
      const rateCheck = await extractLimiter.limit(`extract:${userId}`);
      if (!rateCheck.success) {
        parserUsed = 'rate_limited';
        fallbackReason = 'Batas laju ekstraksi tercapai. Silakan isi formulir secara manual.';
      } else {
        try {
          extracted = await aiExtract({
            mediaType: normalized.mediaType,
            base64: Buffer.from(normalized.bytes).toString('base64'),
          });
        } catch {
          extracted = null;
        }
        if (!extracted) {
          fallbackReason =
            'Penyedia AI tidak merespons atau berkas tidak terbaca. Silakan lengkapi formulir review secara manual.';
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

  try {
    const { data: fileData, error: dlErr } = await supabase.storage
      .from('uploads')
      .download(uploadRow.storage_path);

    if (!dlErr && fileData) {
      const buf = await fileData.arrayBuffer();
      return {
        bytes: new Uint8Array(buf),
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
