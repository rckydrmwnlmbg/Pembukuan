import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { HttpError } from '@/server/http/errors';
import { logger } from '@/server/logging/logger';
import { hashForLookup } from '@/server/crypto/field';
import { extractLimiter } from '@/server/security/rate-limit';
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
import {
  consistencyFlags,
  CONSISTENCY_FLAG_DESCRIPTIONS,
  getLowConfidenceFields,
  shouldFallbackToNeedsManual,
} from '@/server/extraction/checks';
import {
  defaultLedgerStore,
  type LedgerServiceStore,
} from '@/server/ledger/service';
import { generateDemoDataset } from '@/lib/demo-data';
import { createSyntheticProofPng } from '@/lib/synthetic-proofs';
import type { PostUploadReviewInput } from '@/lib/schemas/upload';
import type { ComputedLedgerRow, PeriodBalanceSummary } from '@/lib/ledger-math';

export const MAX_BATCH_FILES = 20; // PRD FR-F3.1

export interface CounterpartyRuleRecord {
  id: string;
  organizationId: string;
  matchAccountNoHash: string;
  descriptionTemplate: string;
  timesUsed: number;
  lastUsedAt: string;
}

export interface UploadRecord {
  id: string;
  kitchenId: string;
  periodId: string;
  storagePath: string;
  originalName: string;
  mime: 'application/pdf' | 'image/jpeg' | 'image/png';
  sizeBytes: number;
  sha256: string;
  status: 'parsed' | 'needs_manual' | 'failed' | 'posted';
  parserUsed: 'ai' | 'manual' | 'rate_limited';
  txDate: string | null;
  referenceNo: string | null;
  amount: string | null;
  senderAccount: string | null;
  recipientAccount: string | null;
  recipientName: string | null;
  recipientBank: string | null;
  memo: string | null;
  suggestedDescription: string | null;
  matchedRuleId: string | null;
  suggestedKitchenId: string | null;
  suggestedKitchenName: string | null;
  wrongKitchenWarning: string | null;
  suggestedIncludeAdminFee: boolean;
  suggestedAdminFeeAmount: string;
  consistencyFlags: string[];
  consistencyReasons: Array<{ code: string; message: string }>;
  lowConfidenceFields: string[];
  confidence: Record<string, number>;
  fallbackReason: string | null;
  postedTransactionId: string | null;
  uploadedBy: string;
  createdAt: string;
}

export interface IncomingUploadFileItem {
  name: string;
  bytes: Uint8Array;
}

function normalizeDigits(val: string | null | undefined): string {
  if (!val) return '';
  return val.replace(/\D/g, '');
}

const DEMO_FALLBACK_KEYS = {
  encryptionKeyBase64: Buffer.alloc(32, 0x41).toString('base64'),
  hashKeyBase64: Buffer.alloc(32, 0x42).toString('base64'),
};

function computeAccountHash(cleanDigits: string): string {
  const hasEnvKeys = Boolean(
    process.env.FIELD_ENCRYPTION_KEY && process.env.FIELD_HASH_KEY,
  );
  return hashForLookup(
    cleanDigits,
    hasEnvKeys ? undefined : DEMO_FALLBACK_KEYS,
  );
}

/**
 * Layanan unggahan bukti transfer, ekstraksi AI, deteksi dapur dari rekening pengirim,
 * aturan penerima (`counterparty_rules`), dan posting hasil review ke buku kas (M3).
 */
export class UploadServiceStore {
  private readonly uploads = new Map<string, UploadRecord>();
  private readonly fileBytesStore = new Map<string, Uint8Array>();
  private readonly counterpartyRules = new Map<string, CounterpartyRuleRecord>();
  private readonly dailyExtractionCounts = new Map<string, number>();
  private readonly ledgerStore: LedgerServiceStore;
  private readonly organizationId = '00000000-0000-4000-8000-000000000099';
  private todayStr = '2026-03-28';

  constructor(ledgerStore: LedgerServiceStore = defaultLedgerStore, seed = 20261025) {
    this.ledgerStore = ledgerStore;
    const dataset = generateDemoDataset(seed);

    // Daftarkan aturan penerima awal dari pola sintetis agar demo langsung mengusulkan deskripsi
    const initialRules: Array<{ accountNo: string; template: string }> = [
      {
        accountNo: '999010018821',
        template: 'Pembelian bahan baku sayur & bumbu dapur SPPG',
      },
      {
        accountNo: '999020024419',
        template: 'Pengisian air galon operasional dapur',
      },
      {
        accountNo: '999030037752',
        template: 'Pembelian beras & telur operasional dapur',
      },
      {
        accountNo: '999060061190',
        template: 'Honorarium relawan dapur SPPG',
      },
    ];

    for (const item of initialRules) {
      const accountHash = computeAccountHash(normalizeDigits(item.accountNo));
      this.counterpartyRules.set(accountHash, {
        id: randomUUID(),
        organizationId: this.organizationId,
        matchAccountNoHash: accountHash,
        descriptionTemplate: item.template,
        timesUsed: 3,
        lastUsedAt: '2026-03-25T08:00:00.000Z',
      });
    }

    // Muat antrean draf & needs_manual sintetis dari demo dataset
    for (const demoUpl of dataset.uploads) {
      const kitchenMeta = this.ledgerStore
        .listKitchenMeta()
        .find((k) => k.id === demoUpl.kitchenId);
      const defaultFee = (kitchenMeta?.adminFeeDefault ?? 6_500n).toString();
      const isDiffBank = Boolean(
        demoUpl.recipientBank &&
          kitchenMeta &&
          demoUpl.recipientBank.toUpperCase() !==
            kitchenMeta.bankCode.toUpperCase(),
      );

      const flags = demoUpl.consistencyFlags;
      const reasons = flags.map((code) => ({
        code,
        message:
          CONSISTENCY_FLAG_DESCRIPTIONS[code] ??
          `Periksa kembali field terkait (${code}).`,
      }));

      const storagePath = `${demoUpl.kitchenId}/${demoUpl.id}.jpg`;
      const sha256 = createHash('sha256')
        .update(`demo-upload-${demoUpl.id}`)
        .digest('hex');

      this.uploads.set(demoUpl.id, {
        id: demoUpl.id,
        kitchenId: demoUpl.kitchenId,
        periodId: demoUpl.periodId,
        storagePath,
        originalName: demoUpl.originalName,
        mime: demoUpl.mime,
        sizeBytes: 42_000,
        sha256,
        status: demoUpl.status === 'needs_manual' ? 'needs_manual' : 'parsed',
        parserUsed: demoUpl.status === 'needs_manual' ? 'manual' : 'ai',
        txDate: demoUpl.txDate,
        referenceNo: demoUpl.referenceNo,
        amount: demoUpl.amount,
        senderAccount: kitchenMeta?.accountNo ?? '999088001001',
        recipientAccount: demoUpl.recipientAccount,
        recipientName: demoUpl.recipientName,
        recipientBank: demoUpl.recipientBank,
        memo: demoUpl.suggestedDescription,
        suggestedDescription: demoUpl.suggestedDescription,
        matchedRuleId: null,
        suggestedKitchenId: demoUpl.kitchenId,
        suggestedKitchenName: kitchenMeta?.name ?? null,
        wrongKitchenWarning: null,
        suggestedIncludeAdminFee: isDiffBank,
        suggestedAdminFeeAmount: defaultFee,
        consistencyFlags: flags,
        consistencyReasons: reasons,
        lowConfidenceFields: demoUpl.lowConfidenceFields,
        confidence:
          demoUpl.status === 'needs_manual'
            ? { txDate: 0.2, referenceNo: 0.1, amount: 0.15 }
            : {
                txDate: 0.96,
                referenceNo: demoUpl.lowConfidenceFields.includes('referenceNo')
                  ? 0.62
                  : 0.95,
                amount: 0.98,
                recipientAccount: 0.95,
                recipientName: 0.94,
                recipientBank: 0.97,
              },
        fallbackReason:
          demoUpl.status === 'needs_manual'
            ? 'Gambar bukti transfer buram atau terpotong sehingga nominal dan tanggal tidak terbaca dengan yakin. Isi formulir di samping berkas secara manual.'
            : null,
        postedTransactionId: null,
        uploadedBy: '00000000-0000-4000-8000-000000000002',
        createdAt: '2026-03-28T09:15:00.000Z',
      });
    }
  }

  public setTodayForTesting(todayIso: string): void {
    this.todayStr = todayIso;
  }

  public getDailyExtractionCount(kitchenId: string): number {
    const key = `${kitchenId}:${this.todayStr}`;
    return this.dailyExtractionCounts.get(key) ?? 0;
  }

  public getCounterpartyRuleByAccount(
    rawAccountNo: string,
  ): CounterpartyRuleRecord | undefined {
    const clean = normalizeDigits(rawAccountNo);
    if (!clean) return undefined;
    const h = computeAccountHash(clean);
    return this.counterpartyRules.get(h);
  }

  public listAllCounterpartyRules(): CounterpartyRuleRecord[] {
    return Array.from(this.counterpartyRules.values());
  }

  /**
   * Mengambil daftar unggahan satu dapur (terisolasi per `kitchenId` — S-02 & S-03).
   */
  public listKitchenUploads(
    kitchenId: string,
    statusFilter: 'all' | 'reviewable' | 'parsed' | 'needs_manual' | 'posted' = 'all',
  ): UploadRecord[] {
    // Pastikan dapur valid
    this.ledgerStore.getKitchenLedger(kitchenId);

    const items: UploadRecord[] = [];
    for (const u of this.uploads.values()) {
      if (u.kitchenId !== kitchenId) continue;
      if (statusFilter === 'reviewable') {
        if (u.status !== 'parsed' && u.status !== 'needs_manual') continue;
      } else if (statusFilter !== 'all' && u.status !== statusFilter) {
        continue;
      }
      items.push(u);
    }
    return items;
  }

  /**
   * Mengambil satu unggahan milik dapur tertentu (S-03 IDOR check: wajib cocok `kitchenId`).
   */
  public getKitchenUploadOrThrow(
    kitchenId: string,
    uploadId: string,
  ): UploadRecord {
    const u = this.uploads.get(uploadId);
    if (!u || u.kitchenId !== kitchenId) {
      throw new HttpError(404, 'Tidak ditemukan');
    }
    return u;
  }

  /**
   * Mengambil byte berkas bukti transfer untuk pratinjau di layar review setelah lolos pemeriksaan peran dapur.
   * Bila berkas demo belum memiliki byte di memori, hasilkan PNG sintetis secara on-the-fly.
   */
  public async getUploadFileBytes(
    kitchenId: string,
    uploadId: string,
  ): Promise<{ bytes: Uint8Array; mime: string; displayName: string }> {
    const u = this.getKitchenUploadOrThrow(kitchenId, uploadId);
    const cached = this.fileBytesStore.get(u.storagePath);
    if (cached) {
      return {
        bytes: cached,
        mime: u.mime,
        displayName: u.originalName,
      };
    }

    const pngBuffer = await createSyntheticProofPng({
      txDate: u.txDate ?? '2026-03-28',
      referenceNo: u.referenceNo ?? 'BELUM-TERBACA',
      senderAccount: u.senderAccount ?? '999088001001',
      recipientAccount: u.recipientAccount ?? '999010018821',
      recipientName: u.recipientName ?? 'UD Pangan Segar Nusantara (Contoh)',
      recipientBank: u.recipientBank ?? 'BCA',
      amountFormatted: u.amount
        ? `Rp ${u.amount.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`
        : 'Rp [TIDAK TERBACA]',
      memo: u.suggestedDescription ?? 'Bukti Transfer Sintetis Demo',
      blurSigma: u.status === 'needs_manual' ? 4 : undefined,
    });
    const arr = new Uint8Array(pngBuffer);
    this.fileBytesStore.set(u.storagePath, arr);

    return {
      bytes: arr,
      mime: 'image/png',
      displayName: u.originalName,
    };
  }

  /**
   * Menemukan dapur pemilik nomor rekening pengirim (PRD FR-F3.4: satu rekening = satu dapur).
   */
  private detectKitchenBySenderAccount(senderAccount: string | null): {
    id: string;
    name: string;
    accountNoLast4: string;
  } | null {
    const cleanSender = normalizeDigits(senderAccount);
    if (!cleanSender) return null;

    const allKitchens = this.ledgerStore.listKitchenMeta();
    for (const k of allKitchens) {
      const cleanKitchenAcc = normalizeDigits(k.accountNo);
      if (
        cleanSender === cleanKitchenAcc ||
        (cleanSender.length >= 4 && cleanSender.endsWith(k.accountNoLast4))
      ) {
        return {
          id: k.id,
          name: k.name,
          accountNoLast4: k.accountNoLast4,
        };
      }
    }
    return null;
  }

  /**
   * Memproses unggahan kumpulan berkas (maks 20 berkas per batch) untuk satu dapur:
   * 1. Validasi magic bytes, ukuran, batas halaman/piksel, rotasi orientasi, dan buang EXIF.
   * 2. Deteksi duplikat SHA-256 dalam dapur yang sama (PRD E6).
   * 3. Pemeriksaan batas biaya (`extractLimiter` & `EXTRACTION_DAILY_LIMIT`) dan `EXTRACTION_MODE`.
   * 4. Panggilan `aiExtract` (satu pintu keluar), pemeriksaan konsistensi (`checks.ts`),
   *    usulan dapur dari rekening pengirim (FR-F3.4), dan usulan deskripsi dari `counterparty_rules` (FR-F4.2).
   * 5. Log HANYA metadata (SECURITY.md S-12).
   */
  public async processBatchUpload(
    kitchenId: string,
    actorId: string,
    files: readonly IncomingUploadFileItem[],
  ): Promise<UploadRecord[]> {
    if (files.length === 0) {
      throw new HttpError(422, 'Pilih minimal 1 berkas bukti transfer.');
    }
    if (files.length > MAX_BATCH_FILES) {
      throw new HttpError(
        422,
        `Maksimal ${MAX_BATCH_FILES} berkas per unggahan (PRD FR-F3.1).`,
      );
    }

    const ledgerData = this.ledgerStore.getKitchenLedger(kitchenId);
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

      // PRD E6: Cek duplikat SHA-256 pada dapur yang sama
      for (const existing of this.uploads.values()) {
        if (
          existing.kitchenId === kitchenId &&
          existing.sha256 === normalized.sha256 &&
          existing.status !== 'failed'
        ) {
          const refInfo = existing.referenceNo
            ? `, referensi ${existing.referenceNo}`
            : '';
          throw new HttpError(
            409,
            `Berkas "${normalized.displayName}" sudah pernah diunggah di dapur ini (ID unggahan: ${existing.id}${refInfo}).`,
          );
        }
      }

      // Simpan byte yang sudah dinormalisasi (tanpa EXIF) di memori/Storage privat
      this.fileBytesStore.set(
        normalized.storagePath,
        new Uint8Array(normalized.bytes),
      );

      const env = getExtractionEnv();
      const dailyKey = `${kitchenId}:${this.todayStr}`;
      const currentDailyCount = this.dailyExtractionCounts.get(dailyKey) ?? 0;

      let extracted: Extracted | null = null;
      let parserUsed: 'ai' | 'manual' | 'rate_limited' = 'ai';
      let fallbackReason: string | null = null;

      if (env.EXTRACTION_MODE === 'manual') {
        parserUsed = 'manual';
        fallbackReason =
          'Mode ekstraksi manual aktif (EXTRACTION_MODE=manual). Silakan isi formulir di samping berkas.';
      } else if (currentDailyCount >= env.EXTRACTION_DAILY_LIMIT) {
        parserUsed = 'rate_limited';
        fallbackReason = `Batas ekstraksi harian dapur (${env.EXTRACTION_DAILY_LIMIT} berkas/hari) telah tercapai. Silakan isi formulir secara manual.`;
      } else {
        // 1. Ekstraksi deterministik lokal jika berkas PDF memuat teks transaksi
        if (normalized.mediaType === 'application/pdf') {
          try {
            const pdfPayload = await extractPayloadFromPdf(normalized.bytes);
            if (pdfPayload.text && pdfPayload.text.trim().length > 10) {
              const localExtracted = parseReceiptText(pdfPayload.text);
              if (localExtracted && localExtracted.txDate && localExtracted.amount) {
                extracted = localExtracted;
                parserUsed = 'ai';
                this.dailyExtractionCounts.set(dailyKey, currentDailyCount + 1);
              }
            }
          } catch {
            // Lanjut ke pemanggilan AI
          }
        }

        // 2. Jika belum terbaca, panggil aiExtract
        if (!extracted || !extracted.txDate || !extracted.amount) {
          const rateCheck = await extractLimiter.limit(`extract:${actorId}`);
          if (!rateCheck.success) {
            parserUsed = 'rate_limited';
            fallbackReason =
              'Batas laju ekstraksi pengguna tercapai. Silakan isi formulir secara manual.';
          } else {
            this.dailyExtractionCounts.set(dailyKey, currentDailyCount + 1);
            extracted = await aiExtract({
              mediaType: normalized.mediaType,
              base64: Buffer.from(normalized.bytes).toString('base64'),
            });
            if (!extracted) {
              fallbackReason =
                'Berkas tidak dapat diekstrak secara otomatis atau penyedia AI tidak merespons. Silakan isi formulir secara manual.';
            }
          }
        }
      }

      const isNeedsManual = shouldFallbackToNeedsManual(extracted);
      const status: 'parsed' | 'needs_manual' = isNeedsManual
        ? 'needs_manual'
        : 'parsed';

      if (isNeedsManual && !fallbackReason) {
        fallbackReason =
          'Tanggal atau nominal pada bukti transfer tidak terbaca dengan yakin. Sistem tidak menebak angka; silakan lengkapi secara manual.';
      }

      const flags = extracted
        ? consistencyFlags(extracted, {
            today: this.todayStr,
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

      // PRD FR-F3.4 & E7: Deteksi dapur dari rekening pengirim (satu rekening = satu dapur)
      const detectedKitchen = this.detectKitchenBySenderAccount(
        extracted?.senderAccount ?? null,
      );
      let wrongKitchenWarning: string | null = null;
      if (detectedKitchen && detectedKitchen.id !== kitchenId) {
        wrongKitchenWarning = `Bukti ini tampaknya milik ${detectedKitchen.name} (rekening pengirim berakhiran ****${detectedKitchen.accountNoLast4}). Periksa kembali sebelum menyimpan.`;
      }

      // PRD FR-F4.2: Usulan deskripsi dari aturan penerima (counterparty_rules lewat HMAC hash)
      const matchedRule = extracted?.recipientAccount
        ? this.getCounterpartyRuleByAccount(extracted.recipientAccount)
        : undefined;
      const suggestedDescription =
        matchedRule?.descriptionTemplate ?? extracted?.memo ?? null;

      // PRD FR-F4.3: Usulan baris admin_fee bila bank penerima berbeda dari bank dapur
      const recipientBank = extracted?.recipientBank ?? null;
      const suggestedIncludeAdminFee = Boolean(
        recipientBank &&
          recipientBank.trim().toUpperCase() !==
            kitchenMeta.bankCode.trim().toUpperCase(),
      );

      const uploadId = randomUUID();
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
        txDate: extracted?.txDate ?? null,
        referenceNo: extracted?.referenceNo ?? null,
        amount: extracted?.amount ?? null,
        senderAccount: extracted?.senderAccount ?? null,
        recipientAccount: extracted?.recipientAccount ?? null,
        recipientName: extracted?.recipientName ?? null,
        recipientBank,
        memo: extracted?.memo ?? null,
        suggestedDescription,
        matchedRuleId: matchedRule?.id ?? null,
        suggestedKitchenId: detectedKitchen?.id ?? null,
        suggestedKitchenName: detectedKitchen?.name ?? null,
        wrongKitchenWarning,
        suggestedIncludeAdminFee,
        suggestedAdminFeeAmount: kitchenMeta.adminFeeDefault.toString(),
        consistencyFlags: flags,
        consistencyReasons: reasons,
        lowConfidenceFields,
        confidence: extracted?.confidence ?? {},
        fallbackReason,
        postedTransactionId: null,
        uploadedBy: actorId,
        createdAt: new Date().toISOString(),
      };

      this.uploads.set(uploadId, record);
      results.push(record);

      // SECURITY.md S-12: Log HANYA metadata, tanpa nomor rekening, tanpa nominal, tanpa rawText!
      logger.info(
        {
          uploadId,
          kitchenId,
          mime: record.mime,
          sizeBytes: record.sizeBytes,
          status: record.status,
          parserUsed: record.parserUsed,
          flagCount: record.consistencyFlags.length,
          lowConfidenceCount: record.lowConfidenceFields.length,
        },
        'upload_processed',
      );
    }

    return results;
  }

  /**
   * Memposting hasil review bukti transfer ke buku kas setelah dikonfirmasi pengguna (PRD FR-F4.4 & FR-F4.5),
   * serta menyimpan/memperbarui aturan penerima (`counterparty_rules` — FR-F4.2).
   */
  public postReviewedUpload(
    kitchenId: string,
    uploadId: string,
    actorId: string,
    input: PostUploadReviewInput,
  ): {
    upload: UploadRecord;
    createdTransactions: ComputedLedgerRow[];
    summary: PeriodBalanceSummary;
    savedRule: CounterpartyRuleRecord | null;
  } {
    const upload = this.getKitchenUploadOrThrow(kitchenId, uploadId);
    if (upload.status === 'posted') {
      throw new HttpError(
        409,
        'Bukti transfer ini sudah pernah diposting ke buku kas.',
      );
    }

    // PRD E7: Jika bukti terdeteksi milik dapur lain, wajib ada konfirmasi eksplisit dari pengguna
    if (upload.wrongKitchenWarning && !input.confirmWrongKitchen) {
      throw new HttpError(
        422,
        `${upload.wrongKitchenWarning} Centang konfirmasi bahwa Anda yakin ingin memposting ke dapur ini.`,
      );
    }

    // PRD E4: Dukungan bukti payroll massal (satu referensi, banyak penerima -> Rekening Masing-Masing Relawan)
    const finalRecipientName = input.isPayrollMassal
      ? input.counterpartyName?.trim() || 'Rekening Masing-Masing Relawan'
      : (input.counterpartyName ?? null);

    // Buat transaksi buku kas (+ pasangan admin_fee atomik bila dicentang).
    // Akan otomatis menolak bila periode terkunci (E9) atau bila (kitchen_id, reference_no, kind) duplikat (E5).
    const { created, summary } = this.ledgerStore.createTransaction(
      kitchenId,
      actorId,
      {
        periodId: input.periodId ?? upload.periodId,
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
      },
    );

    // PRD FR-F4.2: Simpan template deskripsi ke counterparty_rules menggunakan hash HMAC-SHA256
    let savedRule: CounterpartyRuleRecord | null = null;
    const cleanRecipientAcc = normalizeDigits(input.counterpartyAccount);
    if (input.saveCounterpartyRule && cleanRecipientAcc.length >= 4) {
      const accountHash = computeAccountHash(cleanRecipientAcc);
      const existingRule = this.counterpartyRules.get(accountHash);
      const nowIso = new Date().toISOString();

      savedRule = {
        id: existingRule?.id ?? randomUUID(),
        organizationId: this.organizationId,
        matchAccountNoHash: accountHash,
        descriptionTemplate: input.description,
        timesUsed: (existingRule?.timesUsed ?? 0) + 1,
        lastUsedAt: nowIso,
      };
      this.counterpartyRules.set(accountHash, savedRule);
    }

    upload.status = 'posted';
    upload.postedTransactionId = created[0]?.id ?? null;

    logger.info(
      {
        uploadId: upload.id,
        kitchenId,
        createdCount: created.length,
        ruleSaved: Boolean(savedRule),
      },
      'upload_posted_to_ledger',
    );

    return {
      upload,
      createdTransactions: created,
      summary,
      savedRule,
    };
  }
}

export const defaultUploadStore = new UploadServiceStore(defaultLedgerStore);
