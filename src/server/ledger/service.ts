import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import {
  computePeriodLedger,
  type ComputedLedgerRow,
  type LedgerEntryInput,
  type PeriodBalanceSummary,
} from '@/lib/ledger-math';
import { generateDemoDataset, type DemoKitchen } from '@/lib/demo-data';
import { HttpError } from '@/server/http/errors';
import type {
  CreateTransactionInput,
  UpdateTransactionInput,
  VoidTransactionInput,
} from '@/lib/schemas/transaction';
import type {
  UpdateKitchenSettingsInput,
  LockPeriodInput,
  UnlockPeriodInput,
} from '@/lib/schemas/kitchen-settings';
import { encryptField } from '@/server/crypto/field';

export interface AuditRecord {
  id: string;
  kitchenId: string;
  actorId: string;
  action:
    | 'transactions.insert'
    | 'transactions.update'
    | 'transactions.void'
    | 'periods.lock'
    | 'periods.reopen'
    | 'periods.insert'
    | 'kitchens.update';
  entity: 'transactions' | 'periods' | 'kitchens';
  entityId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown>;
  createdAt: string;
}

export interface KitchenLedgerState {
  kitchen: Omit<DemoKitchen, 'entries' | 'summary'>;
  entries: LedgerEntryInput[];
  auditLogs: AuditRecord[];
}

function serializeEntryForAudit(entry: LedgerEntryInput): Record<string, unknown> {
  return {
    id: entry.id,
    kitchenId: entry.kitchenId,
    periodId: entry.periodId,
    parentTransactionId: entry.parentTransactionId ?? null,
    seqNo: entry.seqNo,
    txDate: entry.txDate,
    kind: entry.kind,
    referenceNo: entry.referenceNo,
    description: entry.description,
    counterpartyAccountLast4: entry.counterpartyAccountLast4 ?? null,
    counterpartyName: entry.counterpartyName ?? null,
    counterpartyBank: entry.counterpartyBank ?? null,
    debit: entry.debit.toString(),
    credit: entry.credit.toString(),
    note: entry.note ?? null,
    status: entry.status,
    version: entry.version ?? 1,
  };
}

const DEMO_STORE_DIR = path.join(process.cwd(), '.next', 'kasdapur-demo');
const KITCHENS_FILE = path.join(DEMO_STORE_DIR, 'kitchens.json');

interface SerializedKitchenRecord {
  kitchen: {
    id: string;
    organizationId: string;
    code: string;
    name: string;
    pjName: string;
    bankCode: string;
    accountNo: string;
    accountNoLast4: string;
    openingBalance: string;
    adminFeeDefault: string;
    highAmountThreshold: string;
    periodId: string;
    year: number;
    month: number;
    periodStatus: 'open' | 'locked';
    nextPeriodOpeningBalance: string | null;
    pendingDraftCount: number;
    needsManualCount: number;
    lastUploadDate: string;
  };
  entries: Array<{
    id: string;
    kitchenId: string;
    periodId: string;
    parentTransactionId: string | null;
    seqNo: number;
    txDate: string;
    kind: 'incoming' | 'outgoing' | 'admin_fee';
    referenceNo: string | null;
    description: string;
    counterpartyAccount: string | null;
    counterpartyAccountLast4: string | null;
    counterpartyName: string | null;
    counterpartyBank: string | null;
    debit: string;
    credit: string;
    note: string | null;
    status: 'posted' | 'void';
    version: number;
  }>;
}

/**
 * Penyimpanan buku kas terisolasi per dapur untuk mode demo/uji dan operasi layanan server.
 * Menegakkan seluruh invarian database di lapisan layanan:
 * 1. Isolasi per `kitchenId` (tidak pernah mencampur atau menjumlahkan lintas dapur).
 * 2. Penolakan tulis pada periode terkunci (`periodStatus === 'locked'`).
 * 3. Keunikan `(kitchenId, referenceNo, kind)` untuk transaksi yang bukan `void`.
 * 4. Pembuatan, pembaruan, dan pembatalan (`void`) pasangan `admin_fee` secara atomik.
 * 5. Optimistic locking melalui kolom `version`.
 * 6. Pencatatan `audit_logs` append-only untuk setiap aksi.
 */
export class LedgerServiceStore {
  private readonly states = new Map<string, KitchenLedgerState>();

  private syncKitchensFromDisk(): void {
    if (
      typeof process === 'undefined' ||
      process.env.VITEST ||
      process.env.NODE_ENV === 'test'
    ) {
      return;
    }
    try {
      if (fs.existsSync(KITCHENS_FILE)) {
        const raw = fs.readFileSync(KITCHENS_FILE, 'utf-8');
        const list = JSON.parse(raw) as SerializedKitchenRecord[];
        for (const item of list) {
          const k = item.kitchen;
          const existing = this.states.get(k.id);
          const entries = (item.entries || []).map((e) => ({
            ...e,
            debit: BigInt(e.debit),
            credit: BigInt(e.credit),
          }));
          const kitchenData: Omit<DemoKitchen, 'entries' | 'summary'> = {
            ...k,
            openingBalance: BigInt(k.openingBalance),
            adminFeeDefault: BigInt(k.adminFeeDefault),
            highAmountThreshold: BigInt(k.highAmountThreshold),
            nextPeriodOpeningBalance: k.nextPeriodOpeningBalance
              ? BigInt(k.nextPeriodOpeningBalance)
              : null,
          };
          if (!existing) {
            this.states.set(k.id, {
              kitchen: kitchenData,
              entries,
              auditLogs: [],
            });
          } else {
            existing.kitchen = kitchenData;
            existing.entries = entries;
          }
        }
      }
    } catch {
      // Abaikan jika berkas belum ada
    }
  }

  private persistKitchensToDisk(): void {
    if (
      typeof process === 'undefined' ||
      process.env.VITEST ||
      process.env.NODE_ENV === 'test'
    ) {
      return;
    }
    try {
      if (!fs.existsSync(DEMO_STORE_DIR)) {
        fs.mkdirSync(DEMO_STORE_DIR, { recursive: true });
      }
      const serialized: SerializedKitchenRecord[] = Array.from(
        this.states.values(),
      ).map((st) => ({
        kitchen: {
          ...st.kitchen,
          openingBalance: st.kitchen.openingBalance.toString(),
          adminFeeDefault: st.kitchen.adminFeeDefault.toString(),
          highAmountThreshold: st.kitchen.highAmountThreshold.toString(),
          nextPeriodOpeningBalance: st.kitchen.nextPeriodOpeningBalance
            ? st.kitchen.nextPeriodOpeningBalance.toString()
            : null,
        },
        entries: st.entries.map((e) => ({
          id: e.id,
          kitchenId: e.kitchenId ?? st.kitchen.id,
          periodId: e.periodId ?? st.kitchen.periodId,
          parentTransactionId: e.parentTransactionId ?? null,
          seqNo: e.seqNo,
          txDate: e.txDate,
          kind: e.kind,
          referenceNo: e.referenceNo ?? null,
          description: e.description,
          counterpartyAccount: e.counterpartyAccount ?? null,
          counterpartyAccountLast4: e.counterpartyAccountLast4 ?? null,
          counterpartyName: e.counterpartyName ?? null,
          counterpartyBank: e.counterpartyBank ?? null,
          note: e.note ?? null,
          status: e.status,
          version: e.version ?? 1,
          debit: e.debit.toString(),
          credit: e.credit.toString(),
        })),
      }));
      fs.writeFileSync(KITCHENS_FILE, JSON.stringify(serialized), 'utf-8');
    } catch {
      // Abaikan jika tidak dapat menulis ke disk
    }
  }

  constructor(seed = 20261025) {
    const dataset = generateDemoDataset(seed);
    for (const k of dataset.kitchens) {
      const { entries, summary: _summary, ...kitchenMeta } = k;
      this.states.set(k.id, {
        kitchen: kitchenMeta,
        entries: entries.map((e) => ({
          ...e,
          kitchenId: k.id,
          periodId: k.periodId,
          version: e.version ?? 1,
        })),
        auditLogs: [],
      });
    }
    this.syncKitchensFromDisk();
  }

  public listKitchenMeta(): Array<
    Omit<DemoKitchen, 'entries'> & { summary: PeriodBalanceSummary }
  > {
    this.syncKitchensFromDisk();
    const result: Array<
      Omit<DemoKitchen, 'entries'> & { summary: PeriodBalanceSummary }
    > = [];
    for (const st of this.states.values()) {
      const { summary } = computePeriodLedger(
        st.kitchen.openingBalance,
        st.entries,
      );
      result.push({
        ...st.kitchen,
        summary,
      });
    }
    return result;
  }

  public createKitchen(
    actorId: string,
    input: {
      name: string;
      code: string;
      pjName: string;
      bankCode: string;
      accountNoLast4: string;
      openingBalance: bigint;
      adminFeeDefault?: bigint;
      year?: number;
      month?: number;
    },
    customKitchenId?: string,
    customPeriodId?: string,
  ): Omit<DemoKitchen, 'entries'> & { summary: PeriodBalanceSummary } {
    this.syncKitchensFromDisk();
    const kitchenId = customKitchenId ?? crypto.randomUUID();
    const periodId = customPeriodId ?? crypto.randomUUID();
    const year = input.year ?? 2026;
    const month = input.month ?? 3;
    const openingBalance = input.openingBalance;
    const adminFeeDefault = input.adminFeeDefault ?? 6_500n;

    const normalizedCode = input.code.trim().toUpperCase();
    for (const st of this.states.values()) {
      if (
        st.kitchen.code.toUpperCase() === normalizedCode &&
        st.kitchen.id !== kitchenId
      ) {
        throw new HttpError(409, `Kode dapur ${normalizedCode} sudah digunakan.`);
      }
    }

    const newKitchen: Omit<DemoKitchen, 'entries' | 'summary'> = {
      id: kitchenId,
      organizationId: '00000000-0000-4000-8000-000000000001',
      code: normalizedCode,
      name: input.name.trim(),
      pjName: input.pjName.trim(),
      bankCode: input.bankCode.trim().toUpperCase(),
      accountNo: input.accountNoLast4.trim(),
      accountNoLast4: input.accountNoLast4.trim().slice(-4),
      openingBalance,
      adminFeeDefault,
      highAmountThreshold: 50_000_000n,
      periodId,
      year,
      month,
      periodStatus: 'open',
      nextPeriodOpeningBalance: null,
      pendingDraftCount: 0,
      needsManualCount: 0,
      lastUploadDate: '-',
    };

    const newState: KitchenLedgerState = {
      kitchen: newKitchen,
      entries: [],
      auditLogs: [
        {
          id: crypto.randomUUID(),
          kitchenId,
          actorId,
          action: 'kitchens.update',
          entity: 'kitchens',
          entityId: kitchenId,
          before: null,
          after: {
            id: kitchenId,
            name: newKitchen.name,
            code: newKitchen.code,
          },
          createdAt: new Date().toISOString(),
        },
      ],
    };

    this.states.set(kitchenId, newState);
    this.persistKitchensToDisk();

    const { summary } = computePeriodLedger(openingBalance, []);
    return {
      ...newKitchen,
      summary,
    };
  }

  public clearDemoKitchens(): void {
    const idsToRemove: string[] = [];
    for (const [id, st] of this.states.entries()) {
      if (st.kitchen.code.startsWith('DS-') || id.startsWith('10000000-0000-4000-8000-')) {
        idsToRemove.push(id);
      }
    }
    for (const id of idsToRemove) {
      this.states.delete(id);
    }
    this.persistKitchensToDisk();
  }

  public getKitchen(
    kitchenId: string,
  ): Omit<DemoKitchen, 'entries'> & { summary: PeriodBalanceSummary } {
    const st = this.getKitchenStateOrThrow(kitchenId);
    const { summary } = computePeriodLedger(
      st.kitchen.openingBalance,
      st.entries,
    );
    return {
      ...st.kitchen,
      summary,
    };
  }

  private getKitchenStateOrThrow(kitchenId: string): KitchenLedgerState {
    let st = this.states.get(kitchenId);
    if (!st) {
      this.syncKitchensFromDisk();
      st = this.states.get(kitchenId);
    }
    if (!st) {
      throw new HttpError(404, 'Tidak ditemukan');
    }
    return st;
  }

  private assertPeriodOpen(st: KitchenLedgerState, periodId?: string): void {
    if (periodId && periodId !== st.kitchen.periodId) {
      throw new HttpError(404, 'Periode tidak ditemukan pada dapur ini.');
    }
    if (st.kitchen.periodStatus === 'locked') {
      throw new HttpError(
        409,
        'Periode terkunci. Transaksi pada periode yang sudah dikunci tidak dapat ditambah, diubah, atau dibatalkan.',
      );
    }
  }

  private assertUniqueReference(
    st: KitchenLedgerState,
    referenceNo: string | null | undefined,
    kind: 'incoming' | 'outgoing' | 'admin_fee',
    excludeTxId?: string,
  ): void {
    if (!referenceNo) return;
    const conflict = st.entries.find(
      (e) =>
        e.id !== excludeTxId &&
        e.status !== 'void' &&
        e.referenceNo === referenceNo &&
        e.kind === kind,
    );
    if (conflict) {
      throw new HttpError(
        409,
        `Transaksi dengan nomor referensi "${referenceNo}" dan jenis "${kind}" sudah pernah dicatat di dapur ini.`,
      );
    }
  }

  /**
   * Mengambil daftar transaksi buku kas beserta saldo berjalan dan hasil filter pencarian berparameter.
   */
  public getKitchenLedger(
    kitchenId: string,
    options?: {
      periodId?: string;
      q?: string;
      status?: 'all' | 'posted' | 'void';
    },
  ): {
    kitchen: Omit<DemoKitchen, 'entries' | 'summary'>;
    rows: ComputedLedgerRow[];
    filteredRows: ComputedLedgerRow[];
    summary: PeriodBalanceSummary;
    auditLogs: readonly AuditRecord[];
  } {
    const st = this.getKitchenStateOrThrow(kitchenId);
    if (options?.periodId && options.periodId !== st.kitchen.periodId) {
      throw new HttpError(404, 'Periode tidak ditemukan pada dapur ini.');
    }

    const { rows, summary } = computePeriodLedger(
      st.kitchen.openingBalance,
      st.entries,
    );

    const needle = options?.q?.trim().toLowerCase() ?? '';
    const statusFilter = options?.status ?? 'all';

    const filteredRows = rows.filter((row) => {
      if (statusFilter !== 'all' && row.status !== statusFilter) {
        return false;
      }
      if (!needle) return true;
      const inDesc = row.description.toLowerCase().includes(needle);
      const inRef = (row.referenceNo ?? '').toLowerCase().includes(needle);
      const inName = (row.counterpartyName ?? '').toLowerCase().includes(needle);
      const inAccount = (row.counterpartyAccount ?? '').toLowerCase().includes(needle);
      return inDesc || inRef || inName || inAccount;
    });

    return {
      kitchen: st.kitchen,
      rows,
      filteredRows,
      summary,
      auditLogs: st.auditLogs,
    };
  }

  /**
   * Membuat transaksi manual baru (dana masuk atau dana keluar + pasangan admin_fee atomik).
   */
  public createTransaction(
    kitchenId: string,
    actorId: string,
    input: CreateTransactionInput,
  ): {
    created: ComputedLedgerRow[];
    summary: PeriodBalanceSummary;
  } {
    const st = this.getKitchenStateOrThrow(kitchenId);
    this.assertPeriodOpen(st, input.periodId);

    const [yStr, mStr] = input.txDate.split('-');
    const txYear = yStr ? parseInt(yStr, 10) : NaN;
    const txMonth = mStr ? parseInt(mStr, 10) : NaN;
    if (!isNaN(txYear) && !isNaN(txMonth)) {
      if (st.entries.length === 0 && st.kitchen.periodStatus === 'open') {
        st.kitchen.year = txYear;
        st.kitchen.month = txMonth;
      }
    }

    const refNo = input.referenceNo?.trim() || null;

    if (input.kind === 'outgoing' && input.includeAdminFee && !refNo) {
      throw new HttpError(
        422,
        'Nomor referensi wajib diisi bila menyertakan baris biaya admin bank berpasangan.',
      );
    }

    // Validasi keunikan (kitchen_id, reference_no, kind) sebelum menulis apa pun (atomik)
    this.assertUniqueReference(st, refNo, input.kind);
    if (input.kind === 'outgoing' && input.includeAdminFee) {
      this.assertUniqueReference(st, refNo, 'admin_fee');
    }

    const maxSeq = st.entries.reduce((max, e) => Math.max(max, e.seqNo), 0);
    const parentId = crypto.randomUUID();
    const cleanAccount = input.counterpartyAccount?.replace(/\s+/g, '') || null;
    const last4 = cleanAccount ? cleanAccount.replace(/\D/g, '').slice(-4) : null;

    const mainEntry: LedgerEntryInput = {
      id: parentId,
      kitchenId,
      periodId: st.kitchen.periodId,
      parentTransactionId: null,
      seqNo: maxSeq + 1,
      txDate: input.txDate,
      kind: input.kind,
      referenceNo: refNo,
      description: input.description,
      counterpartyAccount: cleanAccount,
      counterpartyAccountLast4: last4,
      counterpartyName: input.counterpartyName ?? null,
      counterpartyBank: input.counterpartyBank ?? null,
      debit: input.kind === 'incoming' ? input.amount : 0n,
      credit: input.kind === 'outgoing' ? input.amount : 0n,
      note: input.note ?? null,
      status: 'posted',
      version: 1,
    };

    const createdIds = [parentId];
    const newEntries: LedgerEntryInput[] = [mainEntry];

    if (input.kind === 'outgoing' && input.includeAdminFee) {
      const feeId = crypto.randomUUID();
      const feeAmount = input.adminFeeAmount ?? st.kitchen.adminFeeDefault;
      const bankSuffix = input.counterpartyBank
        ? ` ${input.counterpartyBank}`
        : '';

      const feeEntry: LedgerEntryInput = {
        id: feeId,
        kitchenId,
        periodId: st.kitchen.periodId,
        parentTransactionId: parentId,
        seqNo: maxSeq + 2,
        txDate: input.txDate,
        kind: 'admin_fee',
        referenceNo: refNo,
        description: `ADMIN BANK${bankSuffix}`,
        counterpartyAccount: null,
        counterpartyAccountLast4: null,
        counterpartyName: null,
        counterpartyBank: input.counterpartyBank ?? null,
        debit: 0n,
        credit: feeAmount,
        note: null,
        status: 'posted',
        version: 1,
      };

      newEntries.push(feeEntry);
      createdIds.push(feeId);
    }

    // Komit atomik ke daftar transaksi & catat di audit_logs
    const nowIso = new Date().toISOString();
    for (const entry of newEntries) {
      st.entries.push(entry);
      st.auditLogs.push({
        id: crypto.randomUUID(),
        kitchenId,
        actorId,
        action: 'transactions.insert',
        entity: 'transactions',
        entityId: entry.id,
        before: null,
        after: serializeEntryForAudit(entry),
        createdAt: nowIso,
      });
    }

    this.persistKitchensToDisk();

    const { rows, summary } = computePeriodLedger(
      st.kitchen.openingBalance,
      st.entries,
    );

    return {
      created: rows.filter((r) => createdIds.includes(r.id)),
      summary,
    };
  }

  /**
   * Mengedit transaksi dengan optimistic locking (`version`) dan menyinkronkan tanggal/referensi
   * pada baris `admin_fee` pasangannya secara atomik (OI-05 & S-15).
   */
  public updateTransaction(
    kitchenId: string,
    txId: string,
    actorId: string,
    input: UpdateTransactionInput,
  ): {
    updated: ComputedLedgerRow;
    summary: PeriodBalanceSummary;
  } {
    const st = this.getKitchenStateOrThrow(kitchenId);
    this.assertPeriodOpen(st);

    const targetIdx = st.entries.findIndex((e) => e.id === txId);
    if (targetIdx === -1) {
      throw new HttpError(404, 'Transaksi tidak ditemukan.');
    }

    const existing = st.entries[targetIdx]!;
    if (existing.status === 'void') {
      throw new HttpError(
        409,
        'Transaksi yang sudah dibatalkan tidak dapat diedit.',
      );
    }

    const currentVersion = existing.version ?? 1;
    if (currentVersion !== input.version) {
      throw new HttpError(
        409,
        'Konflik perubahan: transaksi ini telah diubah oleh sesi lain. Muat ulang halaman lalu coba kembali.',
      );
    }

    const refNo = input.referenceNo?.trim() || null;
    this.assertUniqueReference(st, refNo, existing.kind, existing.id);

    // Cari pasangan admin_fee bila transaksi ini adalah transaksi induk outgoing
    const pairedFeeIdx =
      existing.kind === 'outgoing'
        ? st.entries.findIndex(
            (e) =>
              e.status !== 'void' &&
              e.kind === 'admin_fee' &&
              (e.parentTransactionId === existing.id ||
                (existing.referenceNo !== null &&
                  e.referenceNo === existing.referenceNo)),
          )
        : -1;

    if (pairedFeeIdx !== -1) {
      const pairedFee = st.entries[pairedFeeIdx]!;
      this.assertUniqueReference(st, refNo, 'admin_fee', pairedFee.id);
    }

    const beforeAudit = serializeEntryForAudit(existing);
    const cleanAccount =
      input.counterpartyAccount !== undefined
        ? input.counterpartyAccount?.replace(/\s+/g, '') || null
        : (existing.counterpartyAccount ?? null);
    const last4 = cleanAccount ? cleanAccount.replace(/\D/g, '').slice(-4) : null;

    const updatedEntry: LedgerEntryInput = {
      ...existing,
      txDate: input.txDate,
      referenceNo: refNo,
      description: input.description,
      counterpartyAccount: cleanAccount,
      counterpartyAccountLast4: last4,
      counterpartyName:
        input.counterpartyName !== undefined
          ? input.counterpartyName
          : (existing.counterpartyName ?? null),
      counterpartyBank:
        input.counterpartyBank !== undefined
          ? input.counterpartyBank
          : (existing.counterpartyBank ?? null),
      debit: existing.kind === 'incoming' ? input.amount : 0n,
      credit: existing.kind !== 'incoming' ? input.amount : 0n,
      note:
        input.note !== undefined ? input.note : (existing.note ?? null),
      version: currentVersion + 1,
    };

    const nowIso = new Date().toISOString();
    st.entries[targetIdx] = updatedEntry;
    st.auditLogs.push({
      id: crypto.randomUUID(),
      kitchenId,
      actorId,
      action: 'transactions.update',
      entity: 'transactions',
      entityId: updatedEntry.id,
      before: beforeAudit,
      after: serializeEntryForAudit(updatedEntry),
      createdAt: nowIso,
    });

    if (pairedFeeIdx !== -1) {
      const oldFee = st.entries[pairedFeeIdx]!;
      const beforeFeeAudit = serializeEntryForAudit(oldFee);
      const updatedFee: LedgerEntryInput = {
        ...oldFee,
        txDate: input.txDate,
        referenceNo: refNo,
        version: (oldFee.version ?? 1) + 1,
      };
      st.entries[pairedFeeIdx] = updatedFee;
      st.auditLogs.push({
        id: crypto.randomUUID(),
        kitchenId,
        actorId,
        action: 'transactions.update',
        entity: 'transactions',
        entityId: updatedFee.id,
        before: beforeFeeAudit,
        after: serializeEntryForAudit(updatedFee),
        createdAt: nowIso,
      });
    }

    this.persistKitchensToDisk();

    const { rows, summary } = computePeriodLedger(
      st.kitchen.openingBalance,
      st.entries,
    );
    const computedRow = rows.find((r) => r.id === txId)!;

    return {
      updated: computedRow,
      summary,
    };
  }

  /**
   * Membatalkan transaksi (`status = 'void'`) dengan optimistic locking (`version`),
   * otomatis membatalkan baris `admin_fee` pasangannya bila ada (OI-05), dan mencatat ke `audit_logs`.
   */
  public voidTransaction(
    kitchenId: string,
    txId: string,
    actorId: string,
    input: VoidTransactionInput,
  ): {
    voidedIds: string[];
    summary: PeriodBalanceSummary;
  } {
    const st = this.getKitchenStateOrThrow(kitchenId);
    this.assertPeriodOpen(st);

    const targetIdx = st.entries.findIndex((e) => e.id === txId);
    if (targetIdx === -1) {
      throw new HttpError(404, 'Transaksi tidak ditemukan.');
    }

    const existing = st.entries[targetIdx]!;
    if (existing.status === 'void') {
      throw new HttpError(409, 'Transaksi ini sudah berstatus dibatalkan.');
    }

    const currentVersion = existing.version ?? 1;
    if (currentVersion !== input.version) {
      throw new HttpError(
        409,
        'Konflik perubahan: transaksi ini telah diubah oleh sesi lain. Muat ulang halaman lalu coba kembali.',
      );
    }

    const nowIso = new Date().toISOString();
    const voidedIds = [existing.id];

    const beforeAudit = serializeEntryForAudit(existing);
    const voidedMain: LedgerEntryInput = {
      ...existing,
      status: 'void',
      note: existing.note
        ? `${existing.note} | Dibatalkan: ${input.reason}`
        : `Dibatalkan: ${input.reason}`,
      version: currentVersion + 1,
    };
    st.entries[targetIdx] = voidedMain;
    st.auditLogs.push({
      id: crypto.randomUUID(),
      kitchenId,
      actorId,
      action: 'transactions.void',
      entity: 'transactions',
      entityId: voidedMain.id,
      before: beforeAudit,
      after: serializeEntryForAudit(voidedMain),
      createdAt: nowIso,
    });

    // Jika ini transaksi induk outgoing, batalkan juga baris admin_fee pasangannya secara atomik (OI-05)
    if (existing.kind === 'outgoing') {
      for (let i = 0; i < st.entries.length; i += 1) {
        const candidate = st.entries[i]!;
        const isPairedFee =
          candidate.status !== 'void' &&
          candidate.kind === 'admin_fee' &&
          (candidate.parentTransactionId === existing.id ||
            (existing.referenceNo !== null &&
              candidate.referenceNo === existing.referenceNo));

        if (isPairedFee) {
          const beforeFee = serializeEntryForAudit(candidate);
          const voidedFee: LedgerEntryInput = {
            ...candidate,
            status: 'void',
            note: `Dibatalkan bersama transaksi induk (${input.reason})`,
            version: (candidate.version ?? 1) + 1,
          };
          st.entries[i] = voidedFee;
          voidedIds.push(voidedFee.id);
          st.auditLogs.push({
            id: crypto.randomUUID(),
            kitchenId,
            actorId,
            action: 'transactions.void',
            entity: 'transactions',
            entityId: voidedFee.id,
            before: beforeFee,
            after: serializeEntryForAudit(voidedFee),
            createdAt: nowIso,
          });
        }
      }
    }

    this.persistKitchensToDisk();

    const { summary } = computePeriodLedger(
      st.kitchen.openingBalance,
      st.entries,
    );

    return {
      voidedIds,
      summary,
    };
  }

  /**
   * Memperbarui pengaturan dapur (PRD FR-F2 & M4).
   * Menolak kode dapur duplikat, mengenkripsi nomor rekening (AES-256-GCM),
   * mencatat jejak audit append-only, dan mengisolasi data per dapur.
   */
  public updateKitchenSettings(
    kitchenId: string,
    actorId: string,
    input: UpdateKitchenSettingsInput,
  ): Omit<DemoKitchen, 'entries'> & { summary: PeriodBalanceSummary } {
    const st = this.getKitchenStateOrThrow(kitchenId);

    // Validasi keunikan kode dapur
    const normalizedCode = input.code.trim().toUpperCase();
    for (const [otherId, otherState] of this.states.entries()) {
      if (
        otherId !== kitchenId &&
        otherState.kitchen.code.trim().toUpperCase() === normalizedCode
      ) {
        throw new HttpError(
          409,
          `Kode dapur "${input.code}" sudah digunakan oleh dapur lain.`,
        );
      }
    }

    const prev = { ...st.kitchen };
    const cleanAccount = input.accountNo.replace(/\D/g, '');
    const accountNoLast4 = cleanAccount.slice(-4);

    let encryptedAccountNo: string;
    try {
      encryptedAccountNo = encryptField(input.accountNo);
    } catch {
      encryptedAccountNo = encryptField(input.accountNo, {
        encryptionKeyBase64: Buffer.alloc(32, 0x41).toString('base64'),
        hashKeyBase64: Buffer.alloc(32, 0x42).toString('base64'),
      });
    }

    st.kitchen.name = input.name;
    st.kitchen.code = input.code;
    st.kitchen.pjName = input.pjName;
    st.kitchen.bankCode = input.bankCode;
    st.kitchen.accountNo = encryptedAccountNo;
    st.kitchen.accountNoLast4 = accountNoLast4;
    st.kitchen.adminFeeDefault = input.adminFeeDefault;

    if (input.initialOpeningBalance !== undefined) {
      st.kitchen.openingBalance = input.initialOpeningBalance;
    }

    const nowIso = new Date().toISOString();
    st.auditLogs.push({
      id: crypto.randomUUID(),
      kitchenId,
      actorId,
      action: 'kitchens.update',
      entity: 'kitchens',
      entityId: kitchenId,
      before: {
        name: prev.name,
        code: prev.code,
        pjName: prev.pjName,
        bankCode: prev.bankCode,
        accountNoLast4: prev.accountNoLast4,
        adminFeeDefault: prev.adminFeeDefault.toString(),
        openingBalance: prev.openingBalance.toString(),
      },
      after: {
        name: input.name,
        code: input.code,
        pjName: input.pjName,
        bankCode: input.bankCode,
        accountNoLast4,
        adminFeeDefault: input.adminFeeDefault.toString(),
        openingBalance: st.kitchen.openingBalance.toString(),
      },
      createdAt: nowIso,
    });

    this.persistKitchensToDisk();

    const { summary } = computePeriodLedger(
      st.kitchen.openingBalance,
      st.entries,
    );

    return {
      ...st.kitchen,
      summary,
    };
  }

  public updatePeriodOpeningBalance(
    kitchenId: string,
    periodId: string,
    openingBalance: bigint,
    actorId: string,
  ): { periodId: string; openingBalance: bigint; summary: PeriodBalanceSummary } {
    const st = this.getKitchenStateOrThrow(kitchenId);

    if (st.kitchen.periodId !== periodId) {
      throw new HttpError(404, 'Periode tidak ditemukan pada dapur ini.');
    }

    this.assertPeriodOpen(st, periodId);

    const prev = st.kitchen.openingBalance;
    st.kitchen.openingBalance = openingBalance;

    const nowIso = new Date().toISOString();
    st.auditLogs.push({
      id: crypto.randomUUID(),
      kitchenId,
      actorId,
      action: 'kitchens.update',
      entity: 'periods',
      entityId: periodId,
      before: { openingBalance: prev.toString() },
      after: { openingBalance: openingBalance.toString() },
      createdAt: nowIso,
    });

    this.persistKitchensToDisk();

    const { summary } = computePeriodLedger(
      st.kitchen.openingBalance,
      st.entries,
    );

    return {
      periodId,
      openingBalance,
      summary,
    };
  }

  /**
   * Mengunci periode berjalan (PRD FR-F8.1, SECURITY S-15, M4).
   * Maker dapat mengunci; menolak jika ada draf yang belum diposting kecuali disetujui secara eksplisit.
   * Menghitung saldo akhir dan menyimpannya sebagai saldo awal periode berikutnya.
   */
  public lockPeriod(
    kitchenId: string,
    periodId: string,
    actorId: string,
    input?: LockPeriodInput,
  ): {
    periodId: string;
    status: 'locked';
    nextPeriodOpeningBalance: bigint;
    summary: PeriodBalanceSummary;
  } {
    const st = this.getKitchenStateOrThrow(kitchenId);

    if (st.kitchen.periodId !== periodId) {
      throw new HttpError(404, 'Periode tidak ditemukan pada dapur ini.');
    }

    if (st.kitchen.periodStatus === 'locked') {
      throw new HttpError(409, 'Periode sudah dalam keadaan terkunci.');
    }

    if (
      (st.kitchen.pendingDraftCount > 0 || st.kitchen.needsManualCount > 0) &&
      !input?.forceWithUnpostedDrafts
    ) {
      throw new HttpError(
        400,
        `Terdapat ${st.kitchen.pendingDraftCount + st.kitchen.needsManualCount} draf bukti transfer yang belum diposting. Selesaikan atau periksa draf terlebih dahulu sebelum mengunci periode.`,
      );
    }

    const { summary } = computePeriodLedger(
      st.kitchen.openingBalance,
      st.entries,
    );

    st.kitchen.periodStatus = 'locked';
    st.kitchen.nextPeriodOpeningBalance = summary.closingBalance;

    const nowIso = new Date().toISOString();
    st.auditLogs.push({
      id: crypto.randomUUID(),
      kitchenId,
      actorId,
      action: 'periods.lock',
      entity: 'periods',
      entityId: periodId,
      before: { status: 'open' },
      after: {
        status: 'locked',
        closingBalance: summary.closingBalance.toString(),
      },
      createdAt: nowIso,
    });

    this.persistKitchensToDisk();

    return {
      periodId,
      status: 'locked',
      nextPeriodOpeningBalance: summary.closingBalance,
      summary,
    };
  }

  /**
   * Membuka kembali periode terkunci (PRD FR-F8.3, SECURITY S-15, M4).
   * Hanya diizinkan untuk peran admin dengan alasan wajib (minimal 5 karakter).
   * Dicatat secara permanen di audit_logs.
   */
  public unlockPeriod(
    kitchenId: string,
    periodId: string,
    actorId: string,
    input: UnlockPeriodInput,
    userRole: string = 'admin',
  ): {
    periodId: string;
    status: 'open';
  } {
    if (userRole !== 'admin') {
      throw new HttpError(
        403,
        'Hanya admin dapur yang berwenang membuka kembali periode terkunci.',
      );
    }

    if (!input.reason || input.reason.trim().length < 5) {
      throw new HttpError(
        400,
        'Alasan pembukaan kembali periode wajib diisi (minimal 5 karakter).',
      );
    }

    const st = this.getKitchenStateOrThrow(kitchenId);

    if (st.kitchen.periodId !== periodId) {
      throw new HttpError(404, 'Periode tidak ditemukan pada dapur ini.');
    }

    if (st.kitchen.periodStatus !== 'locked') {
      throw new HttpError(400, 'Periode tidak dalam keadaan terkunci.');
    }

    st.kitchen.periodStatus = 'open';
    st.kitchen.nextPeriodOpeningBalance = null;

    const nowIso = new Date().toISOString();
    st.auditLogs.push({
      id: crypto.randomUUID(),
      kitchenId,
      actorId,
      action: 'periods.reopen',
      entity: 'periods',
      entityId: periodId,
      before: { status: 'locked' },
      after: {
        status: 'open',
        reason: input.reason.trim(),
      },
      createdAt: nowIso,
    });

    this.persistKitchensToDisk();

    return {
      periodId,
      status: 'open',
    };
  }

  /**
   * Membuka periode baru secara otomatis dari saldo akhir periode yang terkunci (PRD FR-F8.2 & M4).
   * Menolak jika periode saat ini belum dikunci.
   * Saldo awal periode baru persis sama dengan saldo akhir periode sebelumnya.
   */
  public transitionToNextPeriod(
    kitchenId: string,
    actorId: string,
  ): {
    periodId: string;
    year: number;
    month: number;
    openingBalance: bigint;
    status: 'open';
  } {
    const st = this.getKitchenStateOrThrow(kitchenId);

    if (st.kitchen.periodStatus !== 'locked') {
      throw new HttpError(
        400,
        'Periode saat ini harus dikunci terlebih dahulu sebelum melanjutkan ke periode berikutnya.',
      );
    }

    let nextMonth = st.kitchen.month + 1;
    let nextYear = st.kitchen.year;
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear += 1;
    }

    const newPeriodId = crypto.randomUUID();
    const nextOpening = st.kitchen.nextPeriodOpeningBalance ?? 0n;

    st.kitchen.periodId = newPeriodId;
    st.kitchen.year = nextYear;
    st.kitchen.month = nextMonth;
    st.kitchen.openingBalance = nextOpening;
    st.kitchen.periodStatus = 'open';
    st.kitchen.nextPeriodOpeningBalance = null;
    st.kitchen.pendingDraftCount = 0;
    st.kitchen.needsManualCount = 0;
    st.entries = [];

    const nowIso = new Date().toISOString();
    st.auditLogs.push({
      id: crypto.randomUUID(),
      kitchenId,
      actorId,
      action: 'periods.insert',
      entity: 'periods',
      entityId: newPeriodId,
      before: null,
      after: {
        periodId: newPeriodId,
        year: nextYear,
        month: nextMonth,
        openingBalance: nextOpening.toString(),
        status: 'open',
      },
      createdAt: nowIso,
    });

    this.persistKitchensToDisk();

    return {
      periodId: newPeriodId,
      year: nextYear,
      month: nextMonth,
      openingBalance: nextOpening,
      status: 'open',
    };
  }

  /**
   * Mengambil jejak audit hanya-baca untuk dapur tertentu (PRD F9, SECURITY S-15, M4).
   * Menjamin isolasi penuh per dapur (tidak pernah mengembalikan log dapur lain).
   */
  public getKitchenAuditLogs(kitchenId: string): readonly AuditRecord[] {
    const st = this.getKitchenStateOrThrow(kitchenId);
    return Object.freeze(
      [...st.auditLogs]
        .filter((l) => l.kitchenId === kitchenId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    );
  }
}

const globalForLedger = globalThis as unknown as {
  defaultLedgerStore?: LedgerServiceStore;
};

export const defaultLedgerStore =
  globalForLedger.defaultLedgerStore ?? new LedgerServiceStore();

globalForLedger.defaultLedgerStore = defaultLedgerStore;
