import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/server/supabase/admin';
import { encryptField, hashForLookup, extractLast4Digits } from '@/server/crypto/field';
import { HttpError } from '@/server/http/errors';
import {
  computePeriodLedger,
  type ComputedLedgerRow,
  type LedgerEntryInput,
  type PeriodBalanceSummary,
} from '@/lib/ledger-math';
import type { CreateTransactionInput } from '@/lib/schemas/transaction';

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
  await adminClient.from('kitchen_members').insert({
    kitchen_id: kitchenId,
    user_id: userId,
    role: 'admin',
  });

  // 4. Daftarkan rekening bank
  const accountNoEnc = encryptField(input.accountNo);
  const accountNoHash = hashForLookup(input.accountNo);
  const accountNoLast4 = extractLast4Digits(input.accountNo);

  await adminClient.from('bank_accounts').insert({
    kitchen_id: kitchenId,
    bank_code: input.bankCode.trim().toUpperCase(),
    label: input.name.trim(),
    account_no_enc: accountNoEnc,
    account_no_hash: accountNoHash,
    account_no_last4: accountNoLast4,
    kind: 'operasional',
  });

  // 5. Buat periode buku kas awal
  await adminClient.from('periods').insert({
    id: periodId,
    kitchen_id: kitchenId,
    year,
    month,
    opening_balance: Number(openingBalance),
    status: 'open',
  });

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
