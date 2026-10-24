import { describe, it, expect, beforeEach } from 'vitest';
import { LedgerServiceStore, type AuditRecord } from '@/server/ledger/service';
import { generateDemoDataset } from '@/lib/demo-data';
import { computePeriodLedger } from '@/lib/ledger-math';
import { HttpError } from '@/server/http/errors';

describe('Milestone M4: Kunci Periode, Saldo Awal Otomatis, Pengaturan Dapur, & Jejak Audit', () => {
  let store: LedgerServiceStore;
  const KITCHEN_A = '10000000-0000-4000-8000-000000000001'; // DS-CMP
  const KITCHEN_B = '10000000-0000-4000-8000-000000000002'; // DS-KNG (ada draf)
  const KITCHEN_LOCKED = '10000000-0000-4000-8000-000000000004'; // DS-ANG (terkunci)
  const ACTOR_MAKER = 'aaaaaaaa-1111-4111-8111-111111111111';
  const ACTOR_ADMIN = 'aaaaaaaa-4444-4444-8444-444444444444';

  beforeEach(() => {
    store = new LedgerServiceStore(20261025);
  });

  it('1. Pengaturan dapur: memperbarui metadata, nomor rekening terenkripsi (4 digit terakhir), biaya admin default, dan menolak kode duplikat (PRD FR-F2)', () => {
    const original = store.getKitchen(KITCHEN_A);
    expect(original.accountNoLast4).toBe('1001');

    // Coba perbarui dengan kode milik dapur lain -> wajib ditolak 409
    expect(() =>
      store.updateKitchenSettings(KITCHEN_A, ACTOR_ADMIN, {
        name: 'Dapur Cempaka Baru',
        code: 'DS-KNG', // Duplikat dari Kitchen B
        pjName: 'Rina Kartika',
        bankCode: 'BNI',
        accountNo: '999088009999',
        adminFeeDefault: 6_500n,
      }),
    ).toThrowError(/sudah digunakan/);

    // Perbarui dengan kode dan nomor rekening baru yang valid
    const updated = store.updateKitchenSettings(KITCHEN_A, ACTOR_ADMIN, {
      name: 'Dapur Sentral Cempaka Mandiri',
      code: 'DS-CMP-NEW',
      pjName: 'Rina Kartika SE',
      bankCode: 'BNI',
      accountNo: '999088008822',
      adminFeeDefault: 7_500n,
      initialOpeningBalance: 125_000_000n,
    });

    expect(updated.name).toBe('Dapur Sentral Cempaka Mandiri');
    expect(updated.code).toBe('DS-CMP-NEW');
    expect(updated.pjName).toBe('Rina Kartika SE');
    expect(updated.adminFeeDefault).toBe(7_500n);
    expect(updated.accountNoLast4).toBe('8822');
    expect(updated.openingBalance).toBe(125_000_000n);

    // Jejak audit dapur tercatat
    const logs = store.getKitchenAuditLogs(KITCHEN_A);
    expect(logs.length).toBeGreaterThanOrEqual(1);
    const updateLog = logs.find((l) => l.action === 'kitchens.update');
    expect(updateLog).toBeDefined();
    expect(updateLog?.entity).toBe('kitchens');
    expect(updateLog?.after.code).toBe('DS-CMP-NEW');
    expect(updateLog?.after.accountNoLast4).toBe('8822');
  });

  it('2. Kunci periode: menolak bila masih ada draf belum diposting (kecuali force), dan membekukan seluruh mutasi bahkan dari admin (PRD FR-F8.1 & S-15)', () => {
    const kitchenB = store.getKitchen(KITCHEN_B);
    expect(kitchenB.pendingDraftCount).toBeGreaterThan(0);

    // Percobaan mengunci tanpa forceWithUnpostedDrafts -> wajib ditolak 400
    expect(() =>
      store.lockPeriod(KITCHEN_B, kitchenB.periodId, ACTOR_MAKER, {
        forceWithUnpostedDrafts: false,
      }),
    ).toThrowError(/draf bukti transfer yang belum diposting/);

    // Kunci dengan konfirmasi forceWithUnpostedDrafts
    const lockResult = store.lockPeriod(KITCHEN_B, kitchenB.periodId, ACTOR_MAKER, {
      forceWithUnpostedDrafts: true,
    });

    expect(lockResult.status).toBe('locked');
    expect(lockResult.nextPeriodOpeningBalance).toBe(lockResult.summary.closingBalance);

    // Status dapur kini terkunci
    const stateLocked = store.getKitchen(KITCHEN_B);
    expect(stateLocked.periodStatus).toBe('locked');

    // Penulisan transaksi baru, edit, atau void pada periode terkunci DITOLAK KERAS (409) bahkan dari admin!
    expect(() =>
      store.createTransaction(KITCHEN_B, ACTOR_ADMIN, {
        periodId: kitchenB.periodId,
        txDate: '2026-03-25',
        kind: 'outgoing',
        referenceNo: '20260325LOCKED01',
        description: 'Belanja sayur darurat',
        amount: 250_000n,
      }),
    ).toThrowError(HttpError);

    // Kunci ulang periode yang sudah terkunci juga ditolak
    expect(() =>
      store.lockPeriod(KITCHEN_B, kitchenB.periodId, ACTOR_MAKER),
    ).toThrowError(/sudah dalam keadaan terkunci/);
  });

  it('3. Buka kembali periode: hanya boleh oleh admin dan wajib menyertakan alasan minimal 5 karakter (PRD FR-F8.3 & S-15)', () => {
    const lockedKitchen = store.getKitchen(KITCHEN_LOCKED);
    expect(lockedKitchen.periodStatus).toBe('locked');

    // 1. Non-admin mencoba membuka kembali -> wajib ditolak 403
    expect(() =>
      store.unlockPeriod(
        KITCHEN_LOCKED,
        lockedKitchen.periodId,
        ACTOR_MAKER,
        { reason: 'Perlu revisi data belanja' },
        'maker',
      ),
    ).toThrowError(/Hanya admin dapur/);

    // 2. Admin membuka tanpa alasan atau alasan < 5 karakter -> wajib ditolak 400
    expect(() =>
      store.unlockPeriod(
        KITCHEN_LOCKED,
        lockedKitchen.periodId,
        ACTOR_ADMIN,
        { reason: 'tes' },
        'admin',
      ),
    ).toThrowError(/minimal 5 karakter/);

    // 3. Admin membuka dengan alasan yang sah
    const unlockRes = store.unlockPeriod(
      KITCHEN_LOCKED,
      lockedKitchen.periodId,
      ACTOR_ADMIN,
      { reason: 'Koreksi salah input nominal belanja sayur' },
      'admin',
    );
    expect(unlockRes.status).toBe('open');

    const reopenedKitchen = store.getKitchen(KITCHEN_LOCKED);
    expect(reopenedKitchen.periodStatus).toBe('open');

    // Jejak audit mencatat alasan pembukaan kembali
    const logs = store.getKitchenAuditLogs(KITCHEN_LOCKED);
    const reopenLog = logs.find((l) => l.action === 'periods.reopen');
    expect(reopenLog).toBeDefined();
    expect(reopenLog?.after.reason).toBe(
      'Koreksi salah input nominal belanja sayur',
    );
  });

  it('4. Saldo awal periode berikutnya otomatis dari saldo akhir periode yang dikunci (PRD FR-F8.2 & M4 Task 3)', () => {
    const kitchenA = store.getKitchen(KITCHEN_A);
    const closingMarch = kitchenA.summary.closingBalance;

    // Transisi sebelum dikunci -> wajib ditolak
    expect(() =>
      store.transitionToNextPeriod(KITCHEN_A, ACTOR_MAKER),
    ).toThrowError(/harus dikunci terlebih dahulu/);

    // Kunci periode Maret
    const lockedRes = store.lockPeriod(KITCHEN_A, kitchenA.periodId, ACTOR_MAKER);
    expect(lockedRes.nextPeriodOpeningBalance).toBe(closingMarch);

    // Lakukan transisi ke periode berikutnya (April 2026)
    const nextPeriod = store.transitionToNextPeriod(KITCHEN_A, ACTOR_MAKER);
    expect(nextPeriod.year).toBe(2026);
    expect(nextPeriod.month).toBe(4);
    expect(nextPeriod.openingBalance).toBe(closingMarch); // Saldo awal April === Saldo akhir Maret!
    expect(nextPeriod.status).toBe('open');

    // Dapur A kini berada di periode April dengan saldo awal yang terbawa sempurna
    const currentKitchenA = store.getKitchen(KITCHEN_A);
    expect(currentKitchenA.month).toBe(4);
    expect(currentKitchenA.openingBalance).toBe(closingMarch);
    expect(currentKitchenA.summary.closingBalance).toBe(closingMarch); // Sebelum ada transaksi baru, saldo akhir tetap = saldo awal
  });

  it('5. Integritas saldo & draf: saldo akhir hanya menghitung transaksi posted; draf tidak mengubah saldo (DESIGN.md 8.1)', () => {
    const dataset = generateDemoDataset();
    const demoKenanga = dataset.kitchens.find((k) => k.code === 'DS-KNG')!;

    // Ada 3 draf di Kenanga
    expect(demoKenanga.pendingDraftCount).toBe(3);

    // Hitung independen seluruh transaksi posted
    const { summary: independentSummary } = computePeriodLedger(
      demoKenanga.openingBalance,
      demoKenanga.entries,
    );

    // Saldo akhir di summary sistem === hitungan independen murni
    expect(demoKenanga.summary.closingBalance).toBe(
      independentSummary.closingBalance,
    );

    // Saldo awal + total masuk - total keluar === saldo akhir (persamaan periode persis)
    const equationResult =
      demoKenanga.summary.openingBalance +
      demoKenanga.summary.totalIncoming -
      demoKenanga.summary.totalOutgoing;
    expect(equationResult).toBe(demoKenanga.summary.closingBalance);
  });

  it('6. Isolasi dapur (Aturan Emas #1): Dapur A tidak dapat melihat audit log atau data dapur B; tidak ada total agregat', () => {
    // Tambah perubahan di Dapur A
    store.updateKitchenSettings(KITCHEN_A, ACTOR_ADMIN, {
      name: 'Nama Khusus Alfa',
      code: 'ALFA-01',
      pjName: 'PJ Alfa',
      bankCode: 'BNI',
      accountNo: '999088001111',
      adminFeeDefault: 6_500n,
    });

    const logsA = store.getKitchenAuditLogs(KITCHEN_A);
    const logsB = store.getKitchenAuditLogs(KITCHEN_B);

    // Seluruh log A hanya milik KITCHEN_A
    expect(logsA.every((l) => l.kitchenId === KITCHEN_A)).toBe(true);
    // Seluruh log B hanya milik KITCHEN_B
    expect(logsB.every((l) => l.kitchenId === KITCHEN_B)).toBe(true);
    // Tidak ada percampuran id
    expect(logsA.some((l) => l.kitchenId === KITCHEN_B)).toBe(false);
    expect(logsB.some((l) => l.kitchenId === KITCHEN_A)).toBe(false);

    // Imutabilitas audit log di memori
    expect(() => {
      // @ts-expect-error Pengujian imutabilitas
      logsA.push({} as AuditRecord);
    }).toThrow();
  });

  it('7. Keadaan demo dapur: menampilkan strip saldo dengan keadaan berbeda (terbuka tanpa draf, terbuka dengan draf, terkunci)', () => {
    const allKitchens = store.listKitchenMeta();

    const openWithoutDrafts = allKitchens.find(
      (k) => k.periodStatus === 'open' && k.pendingDraftCount === 0,
    );
    const openWithDrafts = allKitchens.find(
      (k) => k.periodStatus === 'open' && k.pendingDraftCount > 0,
    );
    const lockedKitchen = allKitchens.find((k) => k.periodStatus === 'locked');

    expect(openWithoutDrafts).toBeDefined();
    expect(openWithDrafts).toBeDefined();
    expect(lockedKitchen).toBeDefined();

    expect(openWithoutDrafts?.code).toBe('DS-CMP');
    expect(openWithDrafts?.pendingDraftCount).toBe(3);
    expect(lockedKitchen?.periodStatus).toBe('locked');
  });
});
