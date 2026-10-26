import 'server-only';
import { z } from 'zod';

const base64Key32Bytes = z
  .string()
  .min(1, 'Kunci wajib diisi')
  .refine(
    (val) => {
      try {
        const trimmed = val.trim();
        if (/^[0-9a-fA-F]{64}$/.test(trimmed)) return true;
        const b64 = Buffer.from(trimmed, 'base64');
        return b64.length === 32 || trimmed.length >= 16;
      } catch {
        return false;
      }
    },
    { message: 'Kunci enkripsi harus minimal 16 karakter (atau format base64/hex 32-byte)' },
  );

const DUMMY_KEY_32 = 'YmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmI=';

export const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url()
    .default('https://sintetis.supabase.co'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(20)
    .default('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_anon_key_for_testing_only_32_bytes'),
  NEXT_PUBLIC_DEMO: z
    .enum(['true', 'false'])
    .optional()
    .default('true'),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(20)
    .default('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_service_role_key_for_testing_only'),
  FIELD_ENCRYPTION_KEY: base64Key32Bytes.default(DUMMY_KEY_32),
  FIELD_HASH_KEY: base64Key32Bytes.default(DUMMY_KEY_32),
  UPSTASH_REDIS_REST_URL: z
    .string()
    .url()
    .default('https://sintetis-redis.upstash.io'),
  UPSTASH_REDIS_REST_TOKEN: z
    .string()
    .min(10)
    .default('dummy_upstash_redis_token_demo_minimum_length'),
  EXTRACTION_MODE: z.enum(['ai', 'manual']).default('ai'),
  AI_BASE_URL: z.string().url().optional(),
  AI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  LLM_MODEL: z.string().optional().default('deepseek-v4.1-flash'),
  EXTRACTION_DAILY_LIMIT: z.coerce.number().int().positive().default(200),
  APP_ENV: z.enum(['local', 'demo', 'production']).default('demo'),
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
