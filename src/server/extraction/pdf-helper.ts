import 'server-only';
import zlib from 'node:zlib';
import { PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';

export interface ExtractedPdfPayload {
  image?: { bytes: Uint8Array; mime: 'image/jpeg' | 'image/png' };
  text?: string;
}

function parseStreamText(content: string): string[] {
  const parts: string[] = [];

  // 1. Hex string: <54657374> Tj
  const hexRe = /<([0-9a-fA-F]+)>\s*Tj/g;
  let m = hexRe.exec(content);
  while (m !== null) {
    try {
      const decoded = Buffer.from(m[1]!, 'hex').toString('utf8');
      if (decoded.trim()) parts.push(decoded.trim());
    } catch {
      // Abaikan hex decoding error
    }
    m = hexRe.exec(content);
  }

  // 2. Literal string: (BCA Transfer) Tj
  const litRe = /\(([^)]+)\)\s*Tj/g;
  m = litRe.exec(content);
  while (m !== null) {
    if (m[1]?.trim()) parts.push(m[1].trim());
    m = litRe.exec(content);
  }

  // 3. TJ array: [ (Hello) -20 (World) ] TJ
  const tjArrayRe = /\[(.*?)\]\s*TJ/gs;
  m = tjArrayRe.exec(content);
  while (m !== null) {
    const inner = m[1] || '';
    const innerLitRe = /\(([^)]+)\)/g;
    let im = innerLitRe.exec(inner);
    while (im !== null) {
      if (im[1]?.trim()) parts.push(im[1].trim());
      im = innerLitRe.exec(inner);
    }
    m = tjArrayRe.exec(content);
  }

  return parts;
}

/**
 * Mengekstrak payload gambar atau teks dari berkas PDF untuk dikirim ke penyedia AI.
 * Jika berkas PDF adalah hasil cetak/scan yang memuat gambar JPEG/PNG, ekstrak gambarnya
 * agar dapat dibaca oleh OpenAI-compatible vision.
 * Jika berupa dokumen vektor/teks, ekstrak teksnya untuk dianalisis LLM.
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

    for (const [, obj] of doc.context.enumerateIndirectObjects()) {
      if (!(obj instanceof PDFRawStream)) continue;

      const subtype = obj.dict.get(PDFName.of('Subtype'))?.toString();
      const filter = obj.dict.get(PDFName.of('Filter'))?.toString();

      // Cek apakah ada objek gambar JPEG
      if (!foundImage && subtype === '/Image') {
        if (filter === '/DCTDecode') {
          const contents = obj.getContents();
          if (contents.length > 500) {
            foundImage = {
              bytes: new Uint8Array(contents),
              mime: 'image/jpeg',
            };
          }
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
          // Abaikan stream non-zlib atau gambar Flate
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
