import sharp from 'sharp';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export interface SyntheticProofSpec {
  title?: string;
  txDate: string; // 'YYYY-MM-DD'
  referenceNo: string;
  senderAccount: string; // selalu diawali '9990' (data contoh sintetis)
  recipientAccount: string; // selalu diawali '9990'
  recipientName: string;
  recipientBank: string;
  amountFormatted: string; // mis. 'Rp 2.450.000'
  memo?: string;
  extraFooterText?: string; // mis. untuk menguji kalimat injeksi prompt di atas gambar
  blurSigma?: number; // untuk menguji E19 gambar buram
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildSlipSvg(spec: SyntheticProofSpec): Buffer {
  const title =
    spec.title ?? 'BUKTI TRANSAKSI TRANSFER (DATA CONTOH SINTETIS)';
  const memo = spec.memo ?? 'Pembayaran kebutuhan dapur SPPG (Contoh)';
  const footer =
    spec.extraFooterText ??
    'Dokumen sintetis untuk pengujian Kasdapur — Tanpa merek/rekening nyata';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="900" viewBox="0 0 720 900">
    <rect width="720" height="900" fill="#FAF8F5"/>
    <rect x="36" y="36" width="648" height="828" rx="8" fill="#FFFFFF" stroke="#D5CFC4" stroke-width="2"/>
    <rect x="36" y="36" width="648" height="84" rx="8" fill="#0B4F6C"/>
    <text x="64" y="86" font-family="sans-serif" font-size="20" font-weight="bold" fill="#FFFFFF">${escapeXml(title)}</text>

    <text x="64" y="170" font-family="sans-serif" font-size="15" fill="#52504C">Tanggal Transaksi</text>
    <text x="340" y="170" font-family="monospace" font-size="16" font-weight="bold" fill="#181816">${escapeXml(spec.txDate)}</text>

    <line x1="64" y1="195" x2="656" y2="195" stroke="#E6E1D8" stroke-width="1"/>

    <text x="64" y="235" font-family="sans-serif" font-size="15" fill="#52504C">No. Referensi</text>
    <text x="340" y="235" font-family="monospace" font-size="16" font-weight="bold" fill="#181816">${escapeXml(spec.referenceNo)}</text>

    <line x1="64" y1="260" x2="656" y2="260" stroke="#E6E1D8" stroke-width="1"/>

    <text x="64" y="300" font-family="sans-serif" font-size="15" fill="#52504C">Rekening Pengirim</text>
    <text x="340" y="300" font-family="monospace" font-size="16" fill="#181816">${escapeXml(spec.senderAccount)}</text>

    <line x1="64" y1="325" x2="656" y2="325" stroke="#E6E1D8" stroke-width="1"/>

    <text x="64" y="365" font-family="sans-serif" font-size="15" fill="#52504C">Rekening Penerima</text>
    <text x="340" y="365" font-family="monospace" font-size="16" font-weight="bold" fill="#181816">${escapeXml(spec.recipientAccount)}</text>

    <text x="64" y="410" font-family="sans-serif" font-size="15" fill="#52504C">Nama Penerima</text>
    <text x="340" y="410" font-family="sans-serif" font-size="16" font-weight="bold" fill="#181816">${escapeXml(spec.recipientName)}</text>

    <text x="64" y="455" font-family="sans-serif" font-size="15" fill="#52504C">Bank Tujuan</text>
    <text x="340" y="455" font-family="sans-serif" font-size="16" fill="#181816">${escapeXml(spec.recipientBank)}</text>

    <line x1="64" y1="485" x2="656" y2="485" stroke="#D5CFC4" stroke-width="2"/>

    <rect x="64" y="510" width="592" height="76" rx="6" fill="#EBF3F6"/>
    <text x="88" y="556" font-family="sans-serif" font-size="16" font-weight="bold" fill="#0B4F6C">NOMINAL TRANSFER</text>
    <text x="630" y="556" text-anchor="end" font-family="monospace" font-size="22" font-weight="bold" fill="#181816">${escapeXml(spec.amountFormatted)}</text>

    <text x="64" y="640" font-family="sans-serif" font-size="15" fill="#52504C">Berita / Keterangan</text>
    <text x="64" y="670" font-family="sans-serif" font-size="15" fill="#181816">${escapeXml(memo)}</text>

    <line x1="64" y1="740" x2="656" y2="740" stroke="#E6E1D8" stroke-width="1"/>
    <text x="64" y="780" font-family="sans-serif" font-size="12" fill="#78756F">${escapeXml(footer)}</text>
  </svg>`;

  return Buffer.from(svg, 'utf8');
}

/**
 * Membuat gambar bukti transfer sintetis berformat PNG (tanpa logo/merek bank asli).
 */
export async function createSyntheticProofPng(
  spec: SyntheticProofSpec,
): Promise<Buffer> {
  let pipeline = sharp(buildSlipSvg(spec));
  if (spec.blurSigma && spec.blurSigma > 0) {
    pipeline = pipeline.blur(spec.blurSigma);
  }
  return pipeline.png().toBuffer();
}

/**
 * Membuat gambar bukti transfer sintetis berformat JPEG yang sengaja disisipi metadata EXIF
 * (untuk menguji bahwa `validateAndNormalizeImageBytes` membuang seluruh EXIF — PRD E22 & S-08).
 */
export async function createSyntheticProofJpegWithExif(
  spec: SyntheticProofSpec,
): Promise<Buffer> {
  const baseJpeg = await sharp(buildSlipSvg(spec))
    .withExif({
      IFD0: {
        ImageDescription: 'Synthetic Transfer Proof With Fake EXIF Location',
        Software: 'Kasdapur-Synthetic-Fixture-Generator',
      },
    })
    .jpeg({ quality: 90 })
    .toBuffer();

  return baseJpeg;
}

/**
 * Membuat berkas PDF bukti transfer sintetis dengan `pdf-lib` (tanpa logo/merek bank asli).
 */
export async function createSyntheticProofPdf(
  spec: SyntheticProofSpec,
  options?: {
    pageCount?: number;
    blankScannedSimulation?: boolean;
  },
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const pagesToCreate = options?.pageCount ?? 1;

  for (let p = 0; p < pagesToCreate; p += 1) {
    const page = doc.addPage([595, 842]);
    if (options?.blankScannedSimulation) {
      // Simulasi PDF pindai tanpa lapisan teks (PRD E1)
      page.drawRectangle({
        x: 40,
        y: 680,
        width: 515,
        height: 100,
        color: rgb(0.95, 0.94, 0.92),
      });
      continue;
    }

    page.drawText(
      spec.title ?? 'BUKTI TRANSAKSI TRANSFER (DATA CONTOH SINTETIS)',
      {
        x: 50,
        y: 770,
        size: 14,
        font: fontBold,
        color: rgb(0.04, 0.31, 0.42),
      },
    );
    page.drawText(`Tanggal Transaksi : ${spec.txDate}`, {
      x: 50,
      y: 730,
      size: 11,
      font: fontRegular,
    });
    page.drawText(`No. Referensi     : ${spec.referenceNo}`, {
      x: 50,
      y: 710,
      size: 11,
      font: fontRegular,
    });
    page.drawText(`Rekening Pengirim : ${spec.senderAccount}`, {
      x: 50,
      y: 690,
      size: 11,
      font: fontRegular,
    });
    page.drawText(
      `Rekening Penerima : ${spec.recipientAccount} a.n ${spec.recipientName}`,
      {
        x: 50,
        y: 670,
        size: 11,
        font: fontRegular,
      },
    );
    page.drawText(`Bank Tujuan       : ${spec.recipientBank}`, {
      x: 50,
      y: 650,
      size: 11,
      font: fontRegular,
    });
    page.drawText(`Nominal Transfer  : ${spec.amountFormatted}`, {
      x: 50,
      y: 625,
      size: 12,
      font: fontBold,
    });
    page.drawText(
      `Berita            : ${spec.memo ?? 'Pembelian bahan baku dapur (Contoh)'}`,
      {
        x: 50,
        y: 600,
        size: 11,
        font: fontRegular,
      },
    );
    if (spec.extraFooterText) {
      page.drawText(spec.extraFooterText, {
        x: 50,
        y: 570,
        size: 10,
        font: fontRegular,
      });
    }
  }

  return doc.save();
}

/**
 * Membuat byte PDF sintetis yang memiliki penanda `/Encrypt` di kamus trailer untuk menguji
 * penolakan PDF berproteksi kata sandi (PRD E2).
 */
export function createPasswordProtectedSyntheticPdfBytes(): Uint8Array {
  const raw = `%PDF-1.7\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n5 0 obj\n<< /Filter /Standard /V 2 /R 3 /Length 128 >>\nendobj\ntrailer\n<< /Root 1 0 R /Encrypt 5 0 R >>\n%%EOF`;
  return new Uint8Array(Buffer.from(raw, 'latin1'));
}

/**
 * Membuat byte berformat kotak ISO BMFF `ftypheic` untuk menguji penolakan HEIC (PRD E21).
 */
export function createSyntheticHeicBytes(): Uint8Array {
  const buf = Buffer.alloc(24);
  buf.writeUInt32BE(24, 0);
  buf.write('ftypheic', 4, 'ascii');
  return new Uint8Array(buf);
}
