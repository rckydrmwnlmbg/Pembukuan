import 'server-only';
import { HttpError } from './errors';

/**
 * Memastikan permintaan tulis (POST/PUT/PATCH/DELETE) berasal dari origin yang sama (SECURITY.md S-10).
 */
export function assertSameOrigin(req: Request): void {
  const origin = req.headers.get('origin');
  const host = req.headers.get('host');

  if (!origin || !host) {
    throw new HttpError(403, 'Asal permintaan tidak valid.');
  }

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new HttpError(403, 'Asal permintaan tidak valid.');
  }

  if (originHost !== host) {
    throw new HttpError(403, 'Asal permintaan tidak valid.');
  }
}
