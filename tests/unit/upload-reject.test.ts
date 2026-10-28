import { describe, it, expect, beforeEach } from 'vitest';
import { UploadServiceStore } from '@/server/upload/service';
import { LedgerServiceStore } from '@/server/ledger/service';

describe('Tolak dan Hapus Berkas dari Antrean Review (M3/M4)', () => {
  let ledgerStore: LedgerServiceStore;
  let uploadStore: UploadServiceStore;

  const KITCHEN_A = '10000000-0000-4000-8000-000000000001'; // DS-CMP
  const KITCHEN_B = '10000000-0000-4000-8000-000000000002'; // DS-KNG
  const ACTOR_MAKER = 'aaaaaaaa-1111-4111-8111-111111111111';

  beforeEach(() => {
    ledgerStore = new LedgerServiceStore(20261025);
    uploadStore = new UploadServiceStore(ledgerStore);
  });

  it('1. Berhasil menolak dan menghapus berkas draf dari antrean review', () => {
    const uploadsB = uploadStore.listKitchenUploads(KITCHEN_B);
    const unposted = uploadsB.find((u) => u.status !== 'posted');
    expect(unposted).toBeDefined();

    const uploadId = unposted!.id;
    uploadStore.deleteUpload(KITCHEN_B, uploadId);

    // Pastikan berkas sudah hilang dari daftar antrean
    const afterDelete = uploadStore.listKitchenUploads(KITCHEN_B);
    expect(afterDelete.some((u) => u.id === uploadId)).toBe(false);
  });

  it('2. Menolak penghapusan berkas jika berkas sudah diposting ke buku kas', () => {
    const uploadsB = uploadStore.listKitchenUploads(KITCHEN_B);
    const unposted = uploadsB.find((u) => u.status !== 'posted');
    expect(unposted).toBeDefined();

    const uploadId = unposted!.id;

    // Posting terlebih dahulu
    uploadStore.postReviewedUpload(KITCHEN_B, uploadId, ACTOR_MAKER, {
      periodId: unposted!.periodId,
      txDate: '2026-03-28',
      kind: 'outgoing',
      referenceNo: '202603289901',
      description: 'Pengeluaran Uji Posting',
      amount: 500_000n,
      includeAdminFee: false,
      confirmWrongKitchen: false,
      saveCounterpartyRule: false,
      isPayrollMassal: false,
    });

    // Coba hapus yang sudah berstatus 'posted' -> wajib ditolak 400
    expect(() => uploadStore.deleteUpload(KITCHEN_B, uploadId)).toThrowError(
      /sudah diposting/,
    );
  });

  it('3. Menegakkan isolasi dapur (Aturan Emas #1): Dapur A tidak dapat menghapus berkas Dapur B', () => {
    const uploadsB = uploadStore.listKitchenUploads(KITCHEN_B);
    const unpostedB = uploadsB.find((u) => u.status !== 'posted');
    expect(unpostedB).toBeDefined();

    const uploadIdB = unpostedB!.id;

    // Coba hapus berkas Dapur B menggunakan ID Dapur A -> wajib ditolak 404
    expect(() => uploadStore.deleteUpload(KITCHEN_A, uploadIdB)).toThrowError(
      /tidak ditemukan/i,
    );
  });
});
