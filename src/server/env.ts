import 'server-only';
import { z } from 'zod';

const base64Key32Bytes = z
  .string()
  .min(1, 'Kunci wajib diisi')
  .refine(
    (val) => {
      try {
        return Buffer.from(val, 'base64').length === 32;
      } catch {
        return false;
      }
    },
    { message: 'Harus berupa 32 byte dalam format base64' },
  );

export const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  NEXT_PUBLIC_DEMO: z
    .enum(['true', 'false'])
    .optional()
    .default('false'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  FIELD_ENCRYPTION_KEY: base64Key32Bytes,
  FIELD_HASH_KEY: base64Key32Bytes,
  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(10),
  EXTRACTION_MODE: z.enum(['ai', 'manual']).default('ai'),
  ANTHROPIC_API_KEY: z.string().optional(),
  LLM_MODEL: z.string().optional(),
  EXTRACTION_DAILY_LIMIT: z.coerce.number().int().positive().default(200),
  APP_ENV: z.enum(['local', 'demo', 'production']).default('local'),
  SENTRY_DSN: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

/**
 * Membaca dan memvalidasi variabel lingkungan server (SECURITY.md S-04).
 * Gagal keras jika ada variabel wajib yang hilang atau tidak valid.
 */
export function getEnv(rawEnv: NodeJS.ProcessEnv = process.env): Env {
  if (rawEnv === process.env && cachedEnv) {
    return cachedEnv;
  }
  const parsed = envSchema.parse(rawEnv);
  if (rawEnv === process.env) {
    cachedEnv = parsed;
  }
  return parsed;
}
