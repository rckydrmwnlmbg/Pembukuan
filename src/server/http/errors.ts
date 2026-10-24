import 'server-only';
import { ZodError } from 'zod';
import { logger } from '@/server/logging/logger';

export class HttpError extends Error {
  public readonly status: number;
  public readonly publicMessage: string;

  constructor(status: number, publicMessage: string) {
    super(publicMessage);
    this.name = 'HttpError';
    this.status = status;
    this.publicMessage = publicMessage;
  }
}

/**
 * Mengubah galat menjadi respons HTTP yang aman bagi pengguna (SECURITY.md S-12).
 * Pesan galat database atau stack trace tidak pernah dikirim ke klien.
 */
export function toErrorResponse(e: unknown): Response {
  const requestId = crypto.randomUUID();

  if (e instanceof HttpError) {
    return Response.json(
      { error: e.publicMessage, requestId },
      { status: e.status },
    );
  }

  if (e instanceof ZodError) {
    return Response.json(
      {
        error: 'Data yang dikirim belum sesuai format. Periksa kembali isian formulir.',
        fields: e.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
        requestId,
      },
      { status: 422 },
    );
  }

  logger.error(
    {
      requestId,
      err:
        e instanceof Error
          ? { name: e.name, message: e.message }
          : 'unknown_error',
    },
    'unhandled_server_error',
  );

  return Response.json(
    {
      error: 'Terjadi kesalahan pada server. Coba ulangi beberapa saat lagi dan sertakan kode pelacak bila berulang.',
      requestId,
    },
    { status: 500 },
  );
}
