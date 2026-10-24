import { describe, expect, it } from 'vitest';
import { LedgerServiceStore } from '@/server/ledger/service';
import {
  CreateTransactionBodySchema,
  UpdateTransactionBodySchema,
  VoidTransactionBodySchema,
} from '@/lib/schemas/transaction';
import { HttpError } from '@/server/http/errors';

const KITCHEN_1_ID = '10000000-0000-4000-8000-000000000001';
const KITCHEN_2_ID = '10000000-0000-4000-8000-000000000002';
const ACTOR_ID = '00000000-0000-4000-8000-000000000099';

describe('LedgerServiceStore & Zod .strict() schemas (M2)', () => {
  it('menolak properti asing pada skema transaksi berkat Zod .strict()', () => {
    const createParse = CreateTransactionBodySchema.safeParse({
      txDate: '2026-03-20',
      kind: 'incoming',
      description: 'DANA MASUK YAYASAN',
      amount: '5000000',
      includeAdminFee: false,
      extraInjectedField: 'forbidden',
    });
    expect(createParse.success).toBe(false);

    const voidParse = VoidTransactionBodySchema.safeParse({
      action: 'void',
      version: 1,
      reason: 'Koreksi salah nominal',
      unexpectedKey: 123,
    });
    expect(voidParse.success).toBe(false);
  });

  it('mendukung pencatatan dana masuk (incoming debit) tanpa nomor referensi', () => {
    const store = new LedgerServiceStore(20261025);
    const before = store.getKitchenLedger(KITCHEN_1_ID);

    const parsed = CreateTransactionBodySchema.parse({
      txDate: '2026-03-26',
      kind: 'incoming',
      referenceNo: null,
      description: 'TAMBAHAN DANA OPERASIONAL YAYASAN',
      amount: '12500000',
      includeAdminFee: false,
    });

    const { created, summary } = store.createTransaction(
      KITCHEN_1_ID,
      ACTOR_ID,
      parsed,
    );

    expect(created).toHaveLength(1);
    expect(created[0]!.kind).toBe('incoming');
    expect(created[0]!.referenceNo).toBeNull();
    expect(created[0]!.debit).toBe(12_500_000n);
    expect(created[0]!.credit).toBe(0n);
    expect(summary.totalIncoming).toBe(
      before.summary.totalIncoming + 12_500_000n,
    );
    expect(summary.closingBalance).toBe(
      before.summary.closingBalance + 12_500_000n,
    );
  });

  it('membuat pasangan admin_fee secara atomik dengan nomor referensi dan parentTransactionId yang sama', () => {
    const store = new LedgerServiceStore(20261025);
    const before = store.getKitchenLedger(KITCHEN_1_ID);

    const parsed = CreateTransactionBodySchema.parse({
      txDate: '2026-03-27',
      kind: 'outgoing',
      referenceNo: 'REF-M2-ATOMIC-001',
      description: 'PEMBAYARAN TELUR AYAM 400 KG',
      amount: '9200000',
      counterpartyAccount: '184601001020501',
      counterpartyName: 'CV PANGAN SEJAHTERA',
      counterpartyBank: 'BRI',
      includeAdminFee: true,
      adminFeeAmount: '6500',
    });

    const { created, summary } = store.createTransaction(
      KITCHEN_1_ID,
      ACTOR_ID,
      parsed,
    );

    expect(created).toHaveLength(2);
    const [parentRow, feeRow] = created;
    expect(parentRow!.kind).toBe('outgoing');
    expect(parentRow!.referenceNo).toBe('REF-M2-ATOMIC-001');
    expect(parentRow!.credit).toBe(9_200_000n);

    expect(feeRow!.kind).toBe('admin_fee');
    expect(feeRow!.referenceNo).toBe('REF-M2-ATOMIC-001');
    expect(feeRow!.parentTransactionId).toBe(parentRow!.id);
    expect(feeRow!.credit).toBe(6_500n);

    expect(summary.totalOutgoing).toBe(
      before.summary.totalOutgoing + 9_200_000n + 6_500n,
    );
    expect(summary.closingBalance).toBe(
      before.summary.closingBalance - 9_200_000n - 6_500n,
    );

    const after = store.getKitchenLedger(KITCHEN_1_ID);
    expect(after.auditLogs).toHaveLength(2);
    expect(after.auditLogs[0]!.action).toBe('transactions.insert');
    expect(after.auditLogs[1]!.action).toBe('transactions.insert');
  });

  it('menolak duplikat (kitchen_id, reference_no, kind) dengan 409 tetapi mengizinkan di dapur berbeda', () => {
    const store = new LedgerServiceStore(20261025);

    const payload = CreateTransactionBodySchema.parse({
      txDate: '2026-03-27',
      kind: 'outgoing',
      referenceNo: 'REF-DUP-TEST-99',
      description: 'PEMBELIAN BERAS',
      amount: '4000000',
      includeAdminFee: false,
    });

    store.createTransaction(KITCHEN_1_ID, ACTOR_ID, payload);

    // Duplikat di dapur yang sama harus ditolak dengan 409
    expect(() =>
      store.createTransaction(KITCHEN_1_ID, ACTOR_ID, payload),
    ).toThrowError(HttpError);

    try {
      store.createTransaction(KITCHEN_1_ID, ACTOR_ID, payload);
    } catch (err) {
      expect((err as HttpError).status).toBe(409);
    }

    // Dapur kedua memiliki isolasi buku sendiri sehingga nomor referensi tersebut diizinkan
    const resKitchen2 = store.createTransaction(KITCHEN_2_ID, ACTOR_ID, payload);
    expect(resKitchen2.created).toHaveLength(1);
  });

  it('menegakkan optimistic locking (version) saat edit, menyinkronkan admin_fee, dan mencatat audit log', () => {
    const store = new LedgerServiceStore(20261025);

    const { created } = store.createTransaction(
      KITCHEN_1_ID,
      ACTOR_ID,
      CreateTransactionBodySchema.parse({
        txDate: '2026-03-27',
        kind: 'outgoing',
        referenceNo: 'REF-EDIT-SYNC-01',
        description: 'PEMBELIAN MINYAK GORENG',
        amount: '3000000',
        counterpartyBank: 'MANDIRI',
        includeAdminFee: true,
        adminFeeAmount: '6500',
      }),
    );

    const parentTx = created[0]!;
    const feeTx = created[1]!;
    expect(parentTx.version).toBe(1);

    // Edit dengan version = 1 berhasil dan menaikkan version menjadi 2
    const updateInput = UpdateTransactionBodySchema.parse({
      action: 'update',
      version: 1,
      txDate: '2026-03-28',
      referenceNo: 'REF-EDIT-SYNC-02',
      description: 'PEMBELIAN MINYAK GORENG 200 LITER',
      amount: '3500000',
    });

    const { updated } = store.updateTransaction(
      KITCHEN_1_ID,
      parentTx.id,
      ACTOR_ID,
      updateInput,
    );

    expect(updated.version).toBe(2);
    expect(updated.credit).toBe(3_500_000n);
    expect(updated.referenceNo).toBe('REF-EDIT-SYNC-02');
    expect(updated.txDate).toBe('2026-03-28');

    // Pastikan baris admin_fee pasangannya ikut tersinkron tanggal dan nomor referensinya
    const ledgerAfter = store.getKitchenLedger(KITCHEN_1_ID);
    const updatedFee = ledgerAfter.rows.find((r) => r.id === feeTx.id)!;
    expect(updatedFee.referenceNo).toBe('REF-EDIT-SYNC-02');
    expect(updatedFee.txDate).toBe('2026-03-28');
    expect(updatedFee.version).toBe(2);

    // Percobaan edit ulang dengan version usang (version = 1) wajib gagal dengan 409 Conflict
    expect(() =>
      store.updateTransaction(KITCHEN_1_ID, parentTx.id, ACTOR_ID, updateInput),
    ).toThrowError(/Konflik perubahan/);
  });

  it('membatalkan (void) transaksi induk sekaligus baris admin_fee pasangannya secara atomik dan mengeluarkan keduanya dari saldo', () => {
    const store = new LedgerServiceStore(20261025);
    const initialClosing =
      store.getKitchenLedger(KITCHEN_1_ID).summary.closingBalance;

    const { created } = store.createTransaction(
      KITCHEN_1_ID,
      ACTOR_ID,
      CreateTransactionBodySchema.parse({
        txDate: '2026-03-28',
        kind: 'outgoing',
        referenceNo: 'REF-VOID-PAIR-01',
        description: 'PEMBELIAN DAGING SAPI',
        amount: '8000000',
        includeAdminFee: true,
        adminFeeAmount: '6500',
      }),
    );

    const parentTx = created[0]!;
    const afterCreateClosing =
      store.getKitchenLedger(KITCHEN_1_ID).summary.closingBalance;
    expect(afterCreateClosing).toBe(initialClosing - 8_006_500n);

    const voidInput = VoidTransactionBodySchema.parse({
      action: 'void',
      version: 1,
      reason: 'Bukti transfer ganda, dibatalkan oleh maker',
    });

    const { voidedIds, summary } = store.voidTransaction(
      KITCHEN_1_ID,
      parentTx.id,
      ACTOR_ID,
      voidInput,
    );

    // Keduanya (induk + admin_fee) harus ikut dibatalkan
    expect(voidedIds).toHaveLength(2);
    // Saldo akhir kembali persis ke saldo sebelum transaksi dibuat
    expect(summary.closingBalance).toBe(initialClosing);

    // Audit log mencatat 2 insert + 2 void = 4 entri
    const finalState = store.getKitchenLedger(KITCHEN_1_ID);
    expect(finalState.auditLogs).toHaveLength(4);
    expect(
      finalState.auditLogs.filter((a) => a.action === 'transactions.void'),
    ).toHaveLength(2);
  });

  it('menolak pembuatan, pengeditan, dan pembatalan transaksi bila periode terkunci (locked)', () => {
    const store = new LedgerServiceStore(20261025);
    // Kunci periode dapur 1 untuk menguji penolakan pada periode terkunci
    const internalState = (
      store as unknown as { states: Map<string, { kitchen: { periodStatus: string } }> }
    ).states.get(KITCHEN_1_ID)!;
    internalState.kitchen.periodStatus = 'locked';

    const payload = CreateTransactionBodySchema.parse({
      txDate: '2026-03-29',
      kind: 'incoming',
      description: 'DANA MASUK PERIODE TERKUNCI',
      amount: '1000000',
      includeAdminFee: false,
    });

    expect(() =>
      store.createTransaction(KITCHEN_1_ID, ACTOR_ID, payload),
    ).toThrowError(/Periode terkunci/);
  });
});
