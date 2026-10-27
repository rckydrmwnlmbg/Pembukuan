import 'server-only';
import { type Extracted } from './ai-extract';

const MONTH_MAP: Record<string, string> = {
  jan: '01', januari: '01',
  feb: '02', februari: '02',
  mar: '03', maret: '03',
  apr: '04', april: '04',
  mei: '05', may: '05',
  jun: '06', juni: '06',
  jul: '07', juli: '07',
  agu: '08', ags: '08', agust: '08', agustus: '08', aug: '08',
  sep: '09', sept: '09', september: '09',
  okt: '10', oktober: '10', oct: '10',
  nov: '11', nop: '11', nopember: '11', november: '11',
  des: '12', desember: '12', dec: '12',
};

const BANK_PATTERNS: Array<{ regex: RegExp; name: string }> = [
  { regex: /\b(?:BANK\s+)?BCA\b/i, name: 'BCA' },
  { regex: /\b(?:BANK\s+)?MANDIRI\b/i, name: 'MANDIRI' },
  { regex: /\b(?:BANK\s+)?BRI\b/i, name: 'BRI' },
  { regex: /\b(?:BANK\s+)?BNI\b/i, name: 'BNI' },
  { regex: /\b(?:BANK\s+)?BSI\b/i, name: 'BSI' },
  { regex: /\b(?:BANK\s+)?CIMB(?:\s+NIAGA)?\b/i, name: 'CIMB NIAGA' },
  { regex: /\b(?:BANK\s+)?PERMATA\b/i, name: 'PERMATA' },
  { regex: /\b(?:BANK\s+)?DANAMON\b/i, name: 'DANAMON' },
  { regex: /\b(?:BANK\s+)?JAGO\b/i, name: 'BANK JAGO' },
  { regex: /\bSEABANK\b/i, name: 'SEABANK' },
  { regex: /\b(?:BANK\s+)?BTPN\b/i, name: 'BTPN' },
  { regex: /\bJENIUS\b/i, name: 'JENIUS' },
  { regex: /\bPANIN\b/i, name: 'PANIN' },
  { regex: /\bOCBC(?:\s+NISP)?\b/i, name: 'OCBC' },
  { regex: /\b(?:BANK\s+)?MEGA\b/i, name: 'BANK MEGA' },
  { regex: /\b(?:BANK\s+)?BJB\b/i, name: 'BJB' },
  { regex: /\bBPD\b/i, name: 'BPD' },
  { regex: /\bDANA\b/i, name: 'DANA' },
  { regex: /\bOVO\b/i, name: 'OVO' },
  { regex: /\bGOPAY\b/i, name: 'GOPAY' },
  { regex: /\bSHOPEEPAY\b/i, name: 'SHOPEEPAY' },
  { regex: /\bFLIP\b/i, name: 'FLIP' },
];

function extractDate(text: string): string | null {
  // 1. DD-Mon-YYYY atau DD Mon YYYY atau DD/Mon/YYYY (misal: 22-Jan-2026 atau 25 Maret 2026)
  const dMonY = text.match(/\b(0?[1-9]|[12]\d|3[01])[-/\s]+([A-Za-z]{3,9})[-/\s]+(20\d{2})\b/i);
  if (dMonY) {
    const day = dMonY[1]!.padStart(2, '0');
    const monthKey = dMonY[2]!.toLowerCase();
    const month = MONTH_MAP[monthKey];
    const year = dMonY[3];
    if (month && year) {
      return `${year}-${month}-${day}`;
    }
  }

  // 2. YYYY-MM-DD
  const iso = text.match(/\b(20\d{2})[-/](0[1-9]|1[0-2])[-/](0[1-9]|[12]\d|3[01])\b/);
  if (iso) {
    return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }

  // 3. DD/MM/YYYY or DD-MM-YYYY
  const dmy = text.match(/\b(0[1-9]|[12]\d|3[01])[-/](0[1-9]|1[0-2])[-/](20\d{2})\b/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  }

  return null;
}

function extractAmount(text: string): string | null {
  // 1. Label eksplisit: Amount / Nominal / Total / Transfer : [IDR/Rp] 6,000,000.00
  const labeled = text.match(
    /(?:nominal|jumlah|total|sebesar|transfer|amount)(?:\s*(?:transfer|transaksi))?[:\s]*(?:idr|rp\.?)?\s*([\d.,]+)/i,
  );
  if (labeled && labeled[1]) {
    const raw = labeled[1].trim();
    // Hilangkan desimal sen ,00 atau .00 di akhir jika ada
    const noCents = raw.replace(/[,.]00$/, '');
    const digits = noCents.replace(/[^\d]/g, '');
    if (digits.length >= 1 && digits.length <= 13) {
      try {
        if (BigInt(digits) > 0n) return digits;
      } catch {
        // Abaikan
      }
    }
  }

  // 2. Format IDR atau Rp dengan pemisah: IDR 6,000,000.00 atau Rp 2.450.000
  const curMatches = text.matchAll(/(?:rp\.?|idr)\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?|\d{4,12})\b/gi);
  for (const m of curMatches) {
    const raw = m[1] ?? '';
    const noCents = raw.replace(/[,.]00$/, '');
    const digits = noCents.replace(/[^\d]/g, '');
    if (digits.length >= 3 && digits.length <= 13) {
      try {
        if (BigInt(digits) > 0n) return digits;
      } catch {
        // Abaikan
      }
    }
  }

  return null;
}

function extractReferenceNo(text: string): string | null {
  // 1. Nomor referensi numerik panjang (mis. 20260122131628675842) khas BNI Direct / CMS / Core
  const longNum = text.match(/\b(20\d{14,24})\b/);
  if (longNum && longNum[1]) {
    return longNum[1].trim();
  }

  // 2. Reference No. : 202603250001 atau No. Ref : 202603250001
  const refMatch = text.match(
    /(?:reference\s*no\.?|ref(?:erence)?\s*id|no\.?\s*(?:ref(?:erensi)?|transaksi|resi|dokumen|order)|id\s*transaksi|trace\s*no)[:\s]*([A-Za-z0-9\-_./]{6,64})/i,
  );
  if (refMatch && refMatch[1] && !/^(?:reference|beneficiary|transaction)$/i.test(refMatch[1])) {
    return refMatch[1].trim();
  }

  // 3. Fallback: digit 10-14 berawalan 20
  const midNum = text.match(/\b(20\d{10,13})\b/);
  if (midNum && midNum[1]) {
    return midNum[1].trim();
  }

  return null;
}

function extractAccountsAndNames(text: string): {
  senderAccount: string | null;
  recipientAccount: string | null;
  recipientName: string | null;
} {
  let senderAccount: string | null = null;
  let recipientAccount: string | null = null;
  let recipientName: string | null = null;

  // 1. Pola CMS / Corporate: From Account dan To Account dengan format: <nomor_rekening>/<nama_pemilik>
  const pairs = Array.from(text.matchAll(/(\d{8,25})\s*\/\s*([^\n\r(]+)/g));
  if (pairs.length >= 2) {
    senderAccount = pairs[0]![1]!.trim();
    recipientAccount = pairs[1]![1]!.trim();
    recipientName = pairs[1]![2]!.trim().replace(/\s{2,}.*$/, '').trim();
  } else if (pairs.length === 1) {
    recipientAccount = pairs[0]![1]!.trim();
    recipientName = pairs[0]![2]!.trim().replace(/\s{2,}.*$/, '').trim();
  }

  // 2. Pola label eksplisit jika belum terisi
  if (!recipientAccount) {
    const toAcc = text.match(
      /(?:to\s*account|rekening\s*(?:tujuan|penerima)|ke\s*rekening|no\.?\s*rek(?:ening)?\s*tujuan|rekening\s*tujuan)[:\s]*(\d{8,25})/i,
    );
    if (toAcc && toAcc[1]) {
      recipientAccount = toAcc[1].trim();
    }
  }

  if (!senderAccount) {
    const fromAcc = text.match(
      /(?:from\s*account|rekening\s*pengirim|dari\s*rekening|no\.?\s*rek(?:ening)?\s*pengirim)[:\s]*(\d{8,25})/i,
    );
    if (fromAcc && fromAcc[1]) {
      senderAccount = fromAcc[1].trim();
    }
  }

  if (!recipientName) {
    // a.n UD Pangan Segar
    const anMatch = text.match(/(?:a\.n\.?|atas\s*nama)\s+([^\n\r,:]{2,80})/i);
    if (anMatch && anMatch[1]) {
      recipientName = anMatch[1].trim().replace(/\s+(?:ke|dari|nominal|rp|bank).*$/i, '');
    } else {
      const nameMatch = text.match(
        /(?:nama\s*(?:penerima|tujuan)|beneficiary(?:\s*name)?|penerima)[:\s]+([^\n\r,:]{2,80})/i,
      );
      if (nameMatch && nameMatch[1]) {
        const val = nameMatch[1].trim().replace(/\s+(?:ke|dari|nominal|rp|bank).*$/i, '');
        if (!/^\d+$/.test(val) && !/^(?:information|account)$/i.test(val)) {
          recipientName = val;
        }
      }
    }
  }

  return { senderAccount, recipientAccount, recipientName };
}

function extractBank(text: string): string | null {
  // 1. Cek jika ada label eksplisit: Bank Tujuan : BCA
  const labeled = text.match(/(?:bank\s*(?:tujuan|penerima)?|nama\s*bank)[:\s]*([A-Za-z0-9\s]{2,30})/i);
  if (labeled && labeled[1]) {
    const trimmed = labeled[1].trim().toUpperCase();
    for (const b of BANK_PATTERNS) {
      if (b.regex.test(trimmed)) return b.name;
    }
  }

  // 2. Cek kata kunci bank di seluruh teks
  for (const b of BANK_PATTERNS) {
    if (b.regex.test(text)) {
      return b.name;
    }
  }

  // 3. Jika In-House Transfer (misal BNI Direct internal)
  if (/in\s*house\s*transfer/i.test(text)) {
    return 'BNI';
  }

  return null;
}

function extractMemo(text: string): string | null {
  // 1. Cari keterangan berita / remark yang jelas
  const memoLines = text.match(/(?:INSENTIF\s+[^\n\r]+|BIAYA\s+[^\n\r]+|PEMBELIAN\s+[^\n\r]+|PEMBAYARAN\s+[^\n\r]+|BELANJA\s+[^\n\r]+)/i);
  if (memoLines && memoLines[0]) {
    return memoLines[0].trim();
  }

  const memoMatch = text.match(
    /(?:remark|berita|catatan|keterangan|pesan|memo)[:\s]+([^\n\r]{2,150})/i,
  );
  if (memoMatch && memoMatch[1] && !/^(?:to\s*account|from\s*account|amount)$/i.test(memoMatch[1].trim())) {
    return memoMatch[1].trim();
  }

  return null;
}

/**
 * Parser aturan deterministik bukti transfer bank Indonesia (PRD FR-F3.1, AGENTS.md #4 & #5).
 * Bekerja pada teks hasil ekstraksi dokumen (PDF, OCR) secara lokal tanpa panggilan jaringan keluar.
 */
export function parseReceiptText(rawText: string): Extracted | null {
  if (!rawText || rawText.trim().length < 10) {
    return null;
  }

  const txDate = extractDate(rawText);
  const amount = extractAmount(rawText);

  // Jika tanggal atau nominal tidak terbaca dengan pasti, gagal aman (AGENTS.md #5)
  if (!txDate || !amount) {
    return null;
  }

  const referenceNo = extractReferenceNo(rawText);
  const { senderAccount, recipientAccount, recipientName } = extractAccountsAndNames(rawText);
  const recipientBank = extractBank(rawText);
  const memo = extractMemo(rawText);

  const confidence: Record<string, number> = {
    txDate: 0.98,
    amount: 0.98,
    referenceNo: referenceNo ? 0.95 : 0.3,
    senderAccount: senderAccount ? 0.90 : 0.3,
    recipientAccount: recipientAccount ? 0.92 : 0.3,
    recipientName: recipientName ? 0.90 : 0.3,
    recipientBank: recipientBank ? 0.95 : 0.3,
    memo: memo ? 0.85 : 0.3,
  };

  return {
    txDate,
    referenceNo,
    amount,
    senderAccount,
    recipientAccount,
    recipientName,
    recipientBank,
    memo,
    rawText: rawText.slice(0, 4000),
    confidence,
  };
}
