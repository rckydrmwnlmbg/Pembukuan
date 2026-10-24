import 'server-only';
import {
  validateAndNormalizeImage,
  validateAndNormalizeImageBytes,
  isHeicMagicBytes,
  sniffImageMagicBytes,
  MAX_IMAGE_PIXELS,
  MAX_NORMALIZED_DIMENSION,
  type ValidatedImageResult,
} from '@/server/upload/validate-image';
import {
  validatePdfBytes,
  validatePdfUpload,
  hasPdfMagicBytes,
  MAX_UPLOAD_BYTES,
  MAX_PDF_PAGES,
  sanitizeDisplayName,
  type ValidatedPdfResult,
} from '@/server/upload/validate-pdf';
import { HttpError } from '@/server/http/errors';

export {
  validateAndNormalizeImage,
  validateAndNormalizeImageBytes,
  isHeicMagicBytes,
  sniffImageMagicBytes,
  MAX_IMAGE_PIXELS,
  MAX_NORMALIZED_DIMENSION,
  validatePdfBytes,
  validatePdfUpload,
  hasPdfMagicBytes,
  MAX_UPLOAD_BYTES,
  MAX_PDF_PAGES,
  sanitizeDisplayName,
  type ValidatedImageResult,
  type ValidatedPdfResult,
};

export type NormalizedUploadFile = ValidatedImageResult | ValidatedPdfResult;

/**
 * Pintu masuk tunggal validasi dan normalisasi berkas bukti transfer (PDF, JPG, atau PNG).
 * Memeriksa magic bytes sebenarnya (bukan sekadar ekstensi nama file).
 */
export async function validateAndNormalizeTransferProofBytes(
  bytes: Uint8Array,
  originalName: string,
  kitchenId: string,
): Promise<NormalizedUploadFile> {
  if (bytes.byteLength === 0) {
    throw new HttpError(
      422,
      'Berkas kosong (0 byte). Pilih berkas PDF, JPG, atau PNG yang valid.',
    );
  }
  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new HttpError(
      413,
      'Ukuran berkas melebihi batas maksimum 10 MB per file.',
    );
  }

  if (hasPdfMagicBytes(bytes)) {
    return validatePdfBytes(bytes, originalName, kitchenId);
  }

  if (isHeicMagicBytes(bytes)) {
    throw new HttpError(
      415,
      'Format gambar HEIC tidak didukung. Ubah ke JPG atau PNG terlebih dahulu.',
    );
  }

  if (sniffImageMagicBytes(bytes)) {
    return validateAndNormalizeImageBytes(bytes, originalName, kitchenId);
  }

  throw new HttpError(
    415,
    'Format berkas tidak didukung. Gunakan PDF, JPG, atau PNG.',
  );
}
