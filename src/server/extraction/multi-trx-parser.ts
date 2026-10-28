import 'server-only';
import { PDFDocument, PDFRawStream } from 'pdf-lib';
import zlib from 'node:zlib';

export interface ParsedMultiTrxRow {
  referenceNo: string;
  amount: string; // integer rupiah string e.g. "700000"
  txDate: string; // ISO date 'YYYY-MM-DD'
  service: string;
  recipientName: string;
  recipientBank: string;
  recipientAccount: string;
  isOnlineTransfer: boolean;
}

const MONTH_MAP: Record<string, string> = {
  jan: '01',
  feb: '02',
  mar: '03',
  apr: '04',
  mei: '05',
  may: '05',
  jun: '06',
  jul: '07',
  agu: '08',
  aug: '08',
  sep: '09',
  okt: '10',
  oct: '10',
  nov: '11',
  des: '12',
  dec: '12',
};

function formatIsoDate(rawDate: string): string {
  const parts = rawDate.split('-');
  if (parts.length === 3) {
    const day = parts[0]?.padStart(2, '0') ?? '01';
    const mon = MONTH_MAP[parts[1]?.toLowerCase() ?? ''] ?? '01';
    const yr = parts[2] ?? '2026';
    return `${yr}-${mon}-${day}`;
  }
  return rawDate;
}

/**
 * Mendeteksi apakah berkas PDF merupakan laporan tabel transaksi banyak
 * (misalnya Laporan Status Transaksi BNI Direct)
 * dan mengekstrak seluruh baris transaksinya secara deterministik 100%.
 */
export async function detectAndParseMultiTrxPdf(
  pdfBytes: Uint8Array,
): Promise<ParsedMultiTrxRow[]> {
  try {
    const doc = await PDFDocument.load(pdfBytes, {
      updateMetadata: false,
      throwOnInvalidObject: false,
    });

    const allTxs: ParsedMultiTrxRow[] = [];

    for (const [, obj] of doc.context.enumerateIndirectObjects()) {
      if (!(obj instanceof PDFRawStream)) continue;
      let text = '';
      try {
        text = zlib.inflateSync(Buffer.from(obj.getContents())).toString('utf8');
      } catch {
        continue;
      }

      // Ekstrak token teks PDF (mendukung string literal (...) Tj dan hex <...> Tj)
      const tokens: string[] = [];
      const literalMatches = [...text.matchAll(/\((.*?)\)\s*Tj/g)];
      const hexMatches = [...text.matchAll(/<([0-9a-fA-F\s]+)>\s*Tj/g)];

      if (literalMatches.length > 0) {
        for (const m of literalMatches) {
          const s = (m[1] ?? '')
            .replace(/\\\(/g, '(')
            .replace(/\\\)/g, ')')
            .trim();
          if (s) tokens.push(s);
        }
      } else if (hexMatches.length > 0) {
        for (const m of hexMatches) {
          const cleanHex = (m[1] ?? '').replace(/\s+/g, '');
          if (cleanHex.length % 2 === 0) {
            try {
              const s = Buffer.from(cleanHex, 'hex').toString('utf8').trim();
              if (s) tokens.push(s);
            } catch {
              // ignore decoding error
            }
          }
        }
      }
      if (tokens.length === 0) continue;

      const joinedText = tokens.join(' ');
      if (
        !joinedText.includes('TRANSACTION STATUS') &&
        !joinedText.includes('Online Transfer') &&
        !joinedText.includes('In House') &&
        !text.includes('TRANSACTION STATUS') &&
        !text.includes('Online Transfer') &&
        !text.includes('In House')
      ) {
        continue;
      }

      for (let i = 0; i < tokens.length; i++) {
        const tok = tokens[i];
        if (!tok) continue;

        // Nomor referensi transaksi (16-24 digit angka)
        if (/^\d{16,24}$/.test(tok)) {
          const refNo = tok;
          let amount = 0n;
          let txDate = '';
          let service = '';
          let isOnline = false;

          let j = i + 1;
          while (j < tokens.length && !/^\d{16,24}$/.test(tokens[j] ?? '')) {
            const t = tokens[j] ?? '';
            if (t === 'Online Transfer') {
              service = 'Online Transfer';
              isOnline = true;
            } else if (t.includes('In House')) {
              service = 'In House Transfer to Third Party Account';
            }
            if (/^\d{1,3}(,\d{3})*(\.\d{2})?$/.test(t) && tokens[j - 1] === 'IDR') {
              const cleanAmount = (t.split('.')[0] ?? '').replace(/,/g, '');
              try {
                amount = BigInt(cleanAmount);
              } catch {
                amount = 0n;
              }
            }
            if (/^\d{2}-[A-Za-z]{3}-\d{4}$/.test(t) && !txDate) {
              txDate = formatIsoDate(t);
            }
            j++;
          }

          // Cari nama penerima, rekening tujuan, dan bank di antara 'Berhasil Dijalankan' dan 'Web'
          let recipientName = '';
          let recipientBank = '';
          let recipientAccount = '';

          const berhasilIdx = tokens.indexOf('Berhasil', i);
          if (berhasilIdx !== -1 && berhasilIdx < j) {
            const nameTokens: string[] = [];
            const bankTokens: string[] = [];
            let readingBank = isOnline;

            for (let k = berhasilIdx + 2; k < j; k++) {
              const tk = tokens[k] ?? '';
              if (
                tk === 'Web' ||
                /^\d{2}-[A-Za-z]{3}-\d{4}$/.test(tk) ||
                /^\d{2}:\d{2}:\d{2}$/.test(tk)
              ) {
                break;
              }
              if (/^\d{8,20}$/.test(tk)) {
                recipientAccount = tk;
                continue;
              }
              if (readingBank) {
                const upper = tk.toUpperCase();
                if (
                  upper.startsWith('BANK') ||
                  upper.includes('BANK') ||
                  [
                    'BCA',
                    'BRI',
                    'MANDIRI',
                    'BNI',
                    'BSI',
                    'CIMB',
                    'DANAMON',
                    'PERMATA',
                    'JATENG',
                    'JATIM',
                    'BJB',
                  ].includes(upper) ||
                  upper.startsWith('(PERSERO)') ||
                  /^\d{3}$/.test(tk) ||
                  upper.includes('INDONESIA')
                ) {
                  bankTokens.push(tk);
                } else {
                  readingBank = false;
                  nameTokens.push(tk);
                }
              } else {
                nameTokens.push(tk);
              }
            }
            recipientName = nameTokens.join(' ').trim();
            recipientBank =
              bankTokens.join(' ').trim() || (isOnline ? 'BANK LAIN' : 'BNI');
          }

          if (amount > 0n && txDate) {
            allTxs.push({
              referenceNo: refNo,
              amount: amount.toString(),
              txDate,
              service: service || 'Transfer Bank',
              recipientName: recipientName || 'Penerima Transfer',
              recipientBank: recipientBank || (isOnline ? 'BANK LAIN' : 'BNI'),
              recipientAccount,
              isOnlineTransfer: isOnline,
            });
          }
        }
      }
    }

    return allTxs;
  } catch {
    return [];
  }
}
