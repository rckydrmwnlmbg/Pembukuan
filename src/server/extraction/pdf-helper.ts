import 'server-only';
import zlib from 'node:zlib';
import { PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';

export interface ExtractedPdfPayload {
  image?: { bytes: Uint8Array; mime: 'image/jpeg' | 'image/png' };
  text?: string;
}

function decodePdfString(token: string): string {
  if (token.startsWith('<') && token.endsWith('>')) {
    const hex = token.slice(1, -1);
    try {
      const buf = Buffer.from(hex, 'hex');
      // Periksa apakah UTF-16BE (diawali 0xFEFF atau berseling 0x00)
      if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
        const sub = buf.subarray(2);
        const swapped = Buffer.alloc(sub.length);
        for (let i = 0; i < sub.length - 1; i += 2) {
          swapped[i] = sub[i + 1]!;
          swapped[i + 1] = sub[i]!;
        }
        return swapped.toString('utf16le').trim();
      }
      if (buf.length >= 2 && buf[0] === 0x00) {
        const swapped = Buffer.alloc(buf.length);
        for (let i = 0; i < buf.length - 1; i += 2) {
          swapped[i] = buf[i + 1]!;
          swapped[i + 1] = buf[i]!;
        }
        return swapped.toString('utf16le').trim();
      }
      return buf.toString('utf8').replace(/\0/g, '').trim();
    } catch {
      return '';
    }
  }
  if (token.startsWith('(') && token.endsWith(')')) {
    const raw = token.slice(1, -1);
    return raw
      .replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\b/g, '\b')
      .replace(/\\f/g, '\f')
      .replace(/\\\(/g, '(')
      .replace(/\\\)/g, ')')
      .replace(/\\\\/g, '\\')
      .trim();
  }
  return '';
}

function parseStreamText(content: string): string[] {
  const parts: string[] = [];

  // 1. Array TJ: [ (Hello) -20 (World) ] TJ
  const tjArrayRe = /\[(.*?)\]\s*TJ/gs;
  let tjM = tjArrayRe.exec(content);
  while (tjM !== null) {
    const inner = tjM[1] || '';
    const arrayParts: string[] = [];
    const innerTokenRe = /\((?:[^\\)]|\\.)*\)|<[0-9a-fA-F]+>/g;
    let tok = innerTokenRe.exec(inner);
    while (tok !== null) {
      const s = decodePdfString(tok[0]);
      if (s) arrayParts.push(s);
      tok = innerTokenRe.exec(inner);
    }
    if (arrayParts.length > 0) {
      parts.push(arrayParts.join(' '));
    }
    tjM = tjArrayRe.exec(content);
  }

  // 2. Operator Tj tunggal: (BCA Transfer) Tj atau <54657374> Tj
  const singleTjRe = /(?:\((?:[^\\)]|\\.)*\)|<[0-9a-fA-F]+>)\s*Tj/g;
  let sM = singleTjRe.exec(content);
  while (sM !== null) {
    const rawMatch = sM[0].replace(/\s*Tj$/, '');
    const s = decodePdfString(rawMatch);
    if (s) parts.push(s);
    sM = singleTjRe.exec(content);
  }

  return parts;
}

/**
 * Mengekstrak payload gambar atau teks dari berkas PDF untuk dikirim ke parser/penyedia AI.
 * Jika berkas PDF adalah hasil cetak/scan yang memuat gambar JPEG, ekstrak gambar terbesarnya
 * agar dapat dibaca oleh AI Vision.
 * Jika berupa dokumen teks/vektor, ekstrak teksnya untuk dianalisis parser deterministik atau LLM.
 */
export async function extractPayloadFromPdf(
  pdfBytes: Uint8Array,
): Promise<ExtractedPdfPayload> {
  try {
    const doc = await PDFDocument.load(pdfBytes, {
      updateMetadata: false,
      throwOnInvalidObject: false,
    });

    const textPieces: string[] = [];
    let foundImage: { bytes: Uint8Array; mime: 'image/jpeg' | 'image/png' } | undefined;
    let largestImageBytes = 0;

    for (const [, obj] of doc.context.enumerateIndirectObjects()) {
      if (!(obj instanceof PDFRawStream)) continue;

      const subtype = obj.dict.get(PDFName.of('Subtype'))?.toString();
      const filter = obj.dict.get(PDFName.of('Filter'))?.toString();

      // Cek apakah ada objek gambar JPEG (pilih yang berukuran terbesar)
      if (subtype === '/Image' && filter === '/DCTDecode') {
        const contents = obj.getContents();
        if (contents.length > 500 && contents.length > largestImageBytes) {
          largestImageBytes = contents.length;
          foundImage = {
            bytes: new Uint8Array(contents),
            mime: 'image/jpeg',
          };
        }
      }

      // Cek stream teks
      if (filter === '/FlateDecode') {
        try {
          const raw = obj.getContents();
          const decompressed = zlib.inflateSync(Buffer.from(raw)).toString('latin1');
          const extracted = parseStreamText(decompressed);
          if (extracted.length > 0) {
            textPieces.push(...extracted);
          }
        } catch {
          // Abaikan stream non-zlib atau stream gambar Flate
        }
      } else if (!filter) {
        try {
          const decompressed = Buffer.from(obj.getContents()).toString('latin1');
          const extracted = parseStreamText(decompressed);
          if (extracted.length > 0) {
            textPieces.push(...extracted);
          }
        } catch {
          // Abaikan
        }
      }
    }

    return {
      image: foundImage,
      text: textPieces.length > 0 ? textPieces.join('\n') : undefined,
    };
  } catch {
    return {};
  }
}
