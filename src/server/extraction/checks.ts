import type { Extracted } from './ai-extract';

export const LOW_CONFIDENCE_THRESHOLD = 0.8;

export interface ConsistencyContext {
  today: string; // 'YYYY-MM-DD'
  amountThreshold: bigint;
  existingReferenceNos?: ReadonlySet<string>;
}

export const CONSISTENCY_FLAG_DESCRIPTIONS: Readonly<Record<string, string>> = {
  nominal_tidak_valid:
    'Nominal tidak terbaca atau bernilai nol. Isi nominal sesuai angka pada bukti transfer.',
  tanggal_tidak_terbaca:
    'Tanggal transaksi tidak terbaca dengan yakin. Isi tanggal sesuai bukti transfer.',
  tanggal_di_masa_depan:
    'Tanggal pada bukti berada di masa depan dibandingkan hari ini. Periksa kembali bulan dan tahunnya.',
  nominal_besar:
    'Nominal melebihi ambang perhatian dapur ini. Pastikan setiap digit angka sudah cocok dengan bukti transfer.',
  nominal_tidak_ada_di_transkripsi:
    'Angka nominal tidak ditemukan persis pada teks transkripsi berkas. Periksa kemungkinan salah baca satu digit.',
  referensi_tidak_selaras_tanggal:
    'Awalan tanggal pada nomor referensi berbeda dengan tanggal transaksi (heuristik). Periksa kembali tanggal dan nomor referensi.',
  referensi_duplikat:
    'Nomor referensi ini sudah pernah dicatat di buku kas dapur ini. Pastikan bukan unggahan ganda.',
  lebih_dari_satu_bukti:
    'Tangkapan layar tampak memuat lebih dari satu bukti transfer (PRD E20). Hanya satu transaksi yang diusulkan per berkas.',
};

/**
 * Memeriksa apakah angka nominal `bigint` muncul di dalam teks transkripsi
 * baik dalam format polos (`2450000`), bertitik (`2.450.000`), maupun berkoma (`2,450,000`).
 */
export function amountAppearsInText(text: string, amount: bigint): boolean {
  const plain = amount.toString();
  const withSep = (sep: string) => plain.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  return [plain, withSep('.'), withSep(',')].some((f) => text.includes(f));
}

/**
 * Menjalankan pemeriksaan konsistensi hasil ekstraksi sebelum draf ditampilkan di layar review
 * (PRD FR-F3.7, E19, E20, E23, dan SECURITY.md S-14).
 */
export function consistencyFlags(
  p: Extracted,
  ctx: ConsistencyContext,
): string[] {
  const flags: string[] = [];

  let amount: bigint | null = null;
  if (p.amount && /^\d{1,13}$/.test(p.amount)) {
    amount = BigInt(p.amount);
  }

  if (amount === null || amount <= 0n) {
    flags.push('nominal_tidak_valid');
  }
  if (!p.txDate) {
    flags.push('tanggal_tidak_terbaca');
  } else if (p.txDate > ctx.today) {
    flags.push('tanggal_di_masa_depan');
  }
  if (amount !== null && amount >= ctx.amountThreshold) {
    flags.push('nominal_besar');
  }
  if (
    amount !== null &&
    amount > 0n &&
    p.rawText &&
    !amountAppearsInText(p.rawText, amount)
  ) {
    flags.push('nominal_tidak_ada_di_transkripsi');
  }

  // Heuristik: pada baris contoh berkas sumber, nomor referensi berawalan tanggal transaksi (YYYYMMDD).
  // [Medium confidence] Hanya menandai untuk ditinjau manusia, tidak pernah menolak otomatis.
  if (
    p.referenceNo &&
    p.txDate &&
    /^\d{8}/.test(p.referenceNo) &&
    p.referenceNo.slice(0, 8) !== p.txDate.replaceAll('-', '')
  ) {
    flags.push('referensi_tidak_selaras_tanggal');
  }

  if (
    p.referenceNo &&
    ctx.existingReferenceNos &&
    ctx.existingReferenceNos.has(p.referenceNo)
  ) {
    flags.push('referensi_duplikat');
  }

  // Deteksi lebih dari satu bukti transfer dalam satu tangkapan layar (PRD E20)
  if (p.rawText) {
    const refMatches = p.rawText.match(/\b(?:No\.?\s*Ref(?:erensi)?|Ref\s*ID)\b/gi);
    if (refMatches && refMatches.length > 1) {
      flags.push('lebih_dari_satu_bukti');
    }
  }

  return flags;
}

/**
 * Mengembalikan daftar nama field yang memiliki nilai keyakinan di bawah ambang (FR-F3.6).
 */
export function getLowConfidenceFields(
  confidence: Record<string, number>,
  threshold = LOW_CONFIDENCE_THRESHOLD,
): string[] {
  const low: string[] = [];
  for (const [field, score] of Object.entries(confidence)) {
    if (typeof score === 'number' && score < threshold) {
      low.push(field);
    }
  }
  return low;
}

/**
 * Menentukan apakah hasil ekstraksi layak berstatus `parsed` (siap direview dengan isian awal)
 * atau harus jatuh ke `needs_manual` karena field penting tidak terbaca (PRD FR-F3.5 & E1/E3/E19).
 */
export function shouldFallbackToNeedsManual(p: Extracted | null): boolean {
  if (!p) return true;
  if (!p.txDate || !p.amount) return true;
  if (!/^\d{1,13}$/.test(p.amount) || BigInt(p.amount) <= 0n) return true;
  return false;
}
