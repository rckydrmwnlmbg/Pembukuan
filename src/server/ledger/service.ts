import 'server-only';
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

export interface AuditRecord {
  id: string;
  kitchenId: string;
  actorId: string;
  action: 'transactions.insert' | 'transactions.update' | 'transactions.void';
  entity: 'transactions';
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
  }

  public listKitchenMeta(): Array<
    Omit<DemoKitchen, 'entries'> & { summary: PeriodBalanceSummary }
  > {
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

  private getKitchenStateOrThrow(kitchenId: string): KitchenLedgerState {
    const st = this.states.get(kitchenId);
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

    const { summary } = computePeriodLedger(
      st.kitchen.openingBalance,
      st.entries,
    );

    return {
      voidedIds,
      summary,
    };
  }
}

export const defaultLedgerStore = new LedgerServiceStore();
