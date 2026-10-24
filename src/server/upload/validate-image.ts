import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import sharp, { type Metadata } from 'sharp';
import { HttpError } from '@/server/http/errors';
import { MAX_UPLOAD_BYTES, sanitizeDisplayName } from './validate-pdf';

export const MAX_IMAGE_PIXELS = 25_000_000; // 25 megapiksel — anti decompression bomb (SECURITY.md S-08)
export const MAX_NORMALIZED_DIMENSION = 2000;

export interface ValidatedImageResult {
  bytes: Buffer;
  mediaType: 'image/jpeg' | 'image/png';
  sha256: string;
  storagePath: string;
  displayName: string;
  width: number;
  height: number;
}

/**
 * Mendeteksi apakah byte berformat HEIC/HEIF (`ftypheic`, `ftypheix`, `ftypmif1`, `ftypmsf1`)
 * agar dapat ditolak dengan pesan spesifik sesuai PRD E21.
 */
export function isHeicMagicBytes(b: Uint8Array): boolean {
  if (b.length < 12) return false;
  const boxType = String.fromCharCode(b[4]!, b[5]!, b[6]!, b[7]!);
  if (boxType !== 'ftyp') return false;
  const brand = String.fromCharCode(b[8]!, b[9]!, b[10]!, b[11]!).toLowerCase();
  return ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(brand);
}

/**
 * Memeriksa magic bytes gambar untuk memastikan hanya JPEG atau PNG asli yang diterima (SECURITY.md S-08).
 */
export function sniffImageMagicBytes(b: Uint8Array): 'jpeg' | 'png' | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    return 'jpeg';
  }
  if (
    b.length >= 8 &&
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4e &&
    b[3] === 0x47 &&
    b[4] === 0x0d &&
    b[5] === 0x0a &&
    b[6] === 0x1a &&
    b[7] === 0x0a
  ) {
    return 'png';
  }
  return null;
}

/**
 * Memvalidasi dan menormalisasi byte gambar bukti transfer (JPG/PNG):
 * 1. Ukuran > 0 dan <= 10 MB (`413` bila melebihi batas).
 * 2. Menolak HEIC dengan pesan jelas (PRD E21) dan format lain seperti GIF/SVG/WebP (`415`).
 * 3. Memeriksa batas piksel <= 25.000.000 (`422` bila melebihi batas — anti decompression bomb).
 * 4. Menerapkan orientasi EXIF (`.rotate()`), membuang seluruh metadata EXIF/GPS (PRD E22 & S-08),
 *    dan mengubah ukuran ke maksimal 2000x2000 piksel tanpa memperbesar gambar kecil.
 * 5. Menghitung SHA-256 dan menghasilkan path Storage acak `<kitchenId>/<uuid>.jpg|png` (S-03).
 */
export async function validateAndNormalizeImageBytes(
  bytes: Uint8Array,
  originalName: string,
  kitchenId: string,
): Promise<ValidatedImageResult> {
  if (bytes.byteLength === 0) {
    throw new HttpError(
      422,
      'Berkas gambar kosong (0 byte). Pilih berkas JPG atau PNG yang valid.',
    );
  }
  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new HttpError(
      413,
      'Ukuran berkas melebihi batas maksimum 10 MB per file.',
    );
  }

  if (isHeicMagicBytes(bytes)) {
    throw new HttpError(
      415,
      'Format gambar HEIC tidak didukung. Ubah ke JPG atau PNG terlebih dahulu.',
    );
  }

  const kind = sniffImageMagicBytes(bytes);
  if (!kind) {
    throw new HttpError(
      415,
      'Format gambar tidak didukung. Gunakan JPG atau PNG.',
    );
  }

  let meta: Metadata;
  try {
    const probe = sharp(bytes, {
      limitInputPixels: MAX_IMAGE_PIXELS,
      failOn: 'error',
    });
    meta = await probe.metadata();
  } catch (err) {
    const msg = err instanceof Error ? err.message.toLowerCase() : '';
    if (msg.includes('pixel limit') || msg.includes('exceeds')) {
      throw new HttpError(
        422,
        'Dimensi gambar terlalu besar (melebihi batas 25 megapiksel). Perkecil gambar lalu unggah kembali.',
      );
    }
    throw new HttpError(
      422,
      'Berkas gambar rusak atau tidak dapat diproses. Gunakan tangkapan layar JPG atau PNG yang utuh.',
    );
  }

  if (
    !meta.width ||
    !meta.height ||
    meta.width * meta.height > MAX_IMAGE_PIXELS
  ) {
    throw new HttpError(
      422,
      'Dimensi gambar terlalu besar (melebihi batas 25 megapiksel). Perkecil gambar lalu unggah kembali.',
    );
  }

  // .rotate() menerapkan orientasi EXIF lalu secara bawaan sharp membuang segmen EXIF/GPS/IPTC/XMP
  // ketika tidak memanggil .withMetadata().
  const pipeline = sharp(bytes, {
    limitInputPixels: MAX_IMAGE_PIXELS,
    failOn: 'error',
  })
    .rotate()
    .resize({
      width: MAX_NORMALIZED_DIMENSION,
      height: MAX_NORMALIZED_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    });

  const outBuffer =
    kind === 'png'
      ? await pipeline.png({ compressionLevel: 9 }).toBuffer()
      : await pipeline.jpeg({ quality: 92, mozjpeg: false }).toBuffer();

  const outMeta = await sharp(outBuffer).metadata();
  const sha256 = createHash('sha256').update(bytes).digest('hex');

  return {
    bytes: outBuffer,
    mediaType: kind === 'png' ? 'image/png' : 'image/jpeg',
    sha256,
    storagePath: `${kitchenId}/${randomUUID()}.${kind === 'png' ? 'png' : 'jpg'}`,
    displayName: sanitizeDisplayName(originalName),
    width: outMeta.width ?? meta.width,
    height: outMeta.height ?? meta.height,
  };
}

export async function validateAndNormalizeImage(
  file: File,
  kitchenId: string,
): Promise<ValidatedImageResult> {
  if (file.size === 0) {
    throw new HttpError(
      422,
      'Berkas gambar kosong (0 byte). Pilih berkas JPG atau PNG yang valid.',
    );
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new HttpError(
      413,
      'Ukuran berkas melebihi batas maksimum 10 MB per file.',
    );
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  return validateAndNormalizeImageBytes(bytes, file.name, kitchenId);
}
