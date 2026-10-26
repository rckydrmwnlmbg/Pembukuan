import 'server-only';
import { z } from 'zod';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { requireUser } from '@/server/auth/require-user';
import { assertSameOrigin } from '@/server/http/same-origin';
import { HttpError, toErrorResponse } from '@/server/http/errors';
import { apiLimiter } from '@/server/security/rate-limit';

type UserHandler<TShape extends z.ZodRawShape> = (args: {
  req: Request;
  supabase?: SupabaseClient;
  user: User | { id: string; email: string };
  input: z.infer<z.ZodObject<TShape>>;
}) => Promise<Response>;

/**
 * Pembungkus wajib untuk rute API tingkat pengguna yang tidak terikat satu kitchenId spesifik.
 * Menegakkan autentikasi, anti-CSRF, rate limit, dan validasi skema strict.
 */
export function userRoute<TShape extends z.ZodRawShape>(
  schema: z.ZodObject<TShape>,
  handler: UserHandler<TShape>,
) {
  return async (req: Request): Promise<Response> => {
    try {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        assertSameOrigin(req);
      }

      const { user, supabase } = await requireUser({ redirectOnFailure: false });

      const limited = await apiLimiter.limit(`api:${user.id}`);
      if (!limited.success) {
        const retryAfterSec = Math.max(
          1,
          Math.ceil((limited.reset - Date.now()) / 1000),
        );
        return Response.json(
          {
            error:
              'Terlalu banyak permintaan. Tunggu beberapa saat lalu coba kembali.',
          },
          {
            status: 429,
            headers: { 'Retry-After': String(retryAfterSec) },
          },
        );
      }

      const raw =
        req.method === 'GET' || req.method === 'HEAD'
          ? Object.fromEntries(new URL(req.url).searchParams)
          : await req.json().catch(() => {
              throw new HttpError(400, 'Format body JSON tidak valid.');
            });

      const input = schema.strict().parse(raw);

      return await handler({
        req,
        supabase,
        user,
        input,
      });
    } catch (e) {
      return toErrorResponse(e);
    }
  };
}
