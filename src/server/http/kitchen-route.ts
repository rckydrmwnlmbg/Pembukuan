import 'server-only';
import { z } from 'zod';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { requireKitchenRole, type Role } from '@/server/auth/require-kitchen-role';
import { assertSameOrigin } from '@/server/http/same-origin';
import { HttpError, toErrorResponse } from '@/server/http/errors';
import { apiLimiter } from '@/server/security/rate-limit';

type Handler<TShape extends z.ZodRawShape> = (args: {
  req: Request;
  supabase: SupabaseClient;
  user: User;
  kitchenId: string;
  params: Record<string, string>;
  role: Role;
  input: z.infer<z.ZodObject<TShape>>;
}) => Promise<Response>;

const KitchenParamsSchema = z
  .object({
    kitchenId: z.string().uuid('ID dapur tidak valid.'),
  })
  .passthrough();

/**
 * Pembungkus wajib untuk seluruh Route Handler per dapur (SECURITY.md S-07 & PV-05):
 * 1. Memvalidasi UUID kitchenId dari path params.
 * 2. Memeriksa same-origin pada metode tulis (POST/PUT/PATCH/DELETE).
 * 3. Memverifikasi sesi pengguna (AAL2) dan keanggotaan peran di dapur (404 jika ditolak).
 * 4. Menerapkan rate limit per pengguna (429 disertai header Retry-After).
 * 5. Memvalidasi input dengan `schema.strict()` (menolak field ekstra / mass assignment).
 */
export function kitchenRoute<TShape extends z.ZodRawShape>(
  roles: Role[],
  schema: z.ZodObject<TShape>,
  handler: Handler<TShape>,
) {
  return async (
    req: Request,
    ctx: { params: Promise<Record<string, string>> },
  ): Promise<Response> => {
    try {
      const resolvedParams = await ctx.params;
      const { kitchenId } = KitchenParamsSchema.parse(resolvedParams);

      if (req.method !== 'GET' && req.method !== 'HEAD') {
        assertSameOrigin(req);
      }

      const { supabase, user, role } = await requireKitchenRole(
        kitchenId,
        roles,
      );

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
        kitchenId,
        params: resolvedParams,
        role,
        input,
      });
    } catch (e) {
      return toErrorResponse(e);
    }
  };
}
