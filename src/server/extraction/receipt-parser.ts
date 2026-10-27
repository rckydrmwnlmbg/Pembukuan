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
  // 1. YYYY-MM-DD
  const iso = text.match(/\b(20\d{2})[-/](0[1-9]|1[0-2])[-/](0[1-9]|[12]\d|3[01])\b/);
  if (iso) {
    return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }

  // 2. DD/MM/YYYY or DD-MM-YYYY
  const dmy = text.match(/\b(0[1-9]|[12]\d|3[01])[-/](0[1-9]|1[0-2])[-/](20\d{2})\b/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  }

  // 3. DD Mon YYYY / DD Month YYYY (misal: 25 Mar 2026 atau 25 Maret 2026)
  const dMonY = text.match(/\b(0?[1-9]|[12]\d|3[01])\s+([A-Za-z]{3,9})\s+(20\d{2})\b/i);
  if (dMonY) {
    const day = dMonY[1]!.padStart(2, '0');
    const monthKey = dMonY[2]!.toLowerCase();
    const month = MONTH_MAP[monthKey];
    const year = dMonY[3];
    if (month && year) {
      return `${year}-${month}-${day}`;
    }
  }

  return null;
}

function extractAmount(text: string): string | null {
  // 1. Label eksplisit: Nominal / Jumlah / Total / Transfer : Rp 2.450.000,00
  const labeled = text.match(
    /(?:nominal|jumlah|total|sebesar|transfer|amount)(?:\s*(?:transfer|transaksi))?[:\s]*rp\.?\s*([\d.,]+)/i,
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

  // 2. Format Rp dengan pemisah ribuan: Rp 2.450.000 atau Rp. 150.000
  const rpMatches = text.matchAll(/rp\.?\s*(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?|\d{4,12})\b/gi);
  for (const m of rpMatches) {
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
  const refMatch = text.match(
    /(?:no\.?\s*(?:ref(?:erensi)?|transaksi|resi|dokumen|order)|id\s*transaksi|reference(?:\s*no)?|trace\s*no)[:\s]*([A-Za-z0-9\-_./]{6,64})/i,
  );
  if (refMatch && refMatch[1]) {
    return refMatch[1].trim();
  }

  // Cek nomor referensi numerik panjang (mis. 202603250001)
  const longNum = text.match(/\b(20\d{10,20})\b/);
  if (longNum && longNum[1]) {
    return longNum[1].trim();
  }

  return null;
}

function extractRecipientAccount(text: string): string | null {
  const accMatch = text.match(
    /(?:rekening\s*(?:tujuan|penerima)|ke\s*rekening|no\.?\s*rek(?:ening)?\s*tujuan|rekening\s*tujuan)[:\s]*(\d{8,25})/i,
  );
  if (accMatch && accMatch[1]) {
    return accMatch[1].trim();
  }
  return null;
}

function extractSenderAccount(text: string): string | null {
  const accMatch = text.match(
    /(?:rekening\s*pengirim|dari\s*rekening|no\.?\s*rek(?:ening)?\s*pengirim)[:\s]*(\d{8,25})/i,
  );
  if (accMatch && accMatch[1]) {
    return accMatch[1].trim();
  }
  return null;
}

function extractRecipientName(text: string): string | null {
  // Misal: Rekening Penerima : 999010018821 a.n UD Pangan Segar
  const anMatch = text.match(/(?:a\.n\.?|atas\s*nama)\s+([^\n\r,:]{2,80})/i);
  if (anMatch && anMatch[1]) {
    return anMatch[1].trim().replace(/\s+(?:ke|dari|nominal|rp|bank).*$/i, '');
  }

  // Misal: Nama Penerima : UD Pangan Segar
  const nameMatch = text.match(
    /(?:nama\s*(?:penerima|tujuan)|penerima)[:\s]+([^\n\r,:]{2,80})/i,
  );
  if (nameMatch && nameMatch[1]) {
    const val = nameMatch[1].trim().replace(/\s+(?:ke|dari|nominal|rp|bank).*$/i, '');
    if (!/^\d+$/.test(val)) return val;
  }

  return null;
}

function extractBank(text: string): string | null {
  // Cek jika ada label eksplisit: Bank Tujuan : BCA
  const labeled = text.match(/(?:bank\s*(?:tujuan|penerima)?|nama\s*bank)[:\s]*([A-Za-z0-9\s]{2,30})/i);
  if (labeled && labeled[1]) {
    const trimmed = labeled[1].trim().toUpperCase();
    for (const b of BANK_PATTERNS) {
      if (b.regex.test(trimmed)) return b.name;
    }
  }

  // Cek kata kunci bank di seluruh teks
  for (const b of BANK_PATTERNS) {
    if (b.regex.test(text)) {
      return b.name;
    }
  }

  return null;
}

function extractMemo(text: string): string | null {
  const memoMatch = text.match(
    /(?:berita|catatan|keterangan|pesan|memo)[:\s]+([^\n\r]{2,150})/i,
  );
  if (memoMatch && memoMatch[1]) {
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
  const senderAccount = extractSenderAccount(rawText);
  const recipientAccount = extractRecipientAccount(rawText);
  const recipientName = extractRecipientName(rawText);
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
