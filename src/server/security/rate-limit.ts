import 'server-only';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

export interface RateLimiterLike {
  limit(identifier: string): Promise<RateLimitResult>;
}

/**
 * Pembatas laju sliding-window di memori untuk pengujian unit/lokal saat Upstash Redis
 * belum dikonfigurasi, sekaligus pembungkus Upstash Ratelimit untuk produksi (SECURITY.md S-09).
 */
export class InMemorySlidingWindowLimiter implements RateLimiterLike {
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private readonly hits = new Map<string, number[]>();

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  public async limit(identifier: string): Promise<RateLimitResult> {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    const prev = (this.hits.get(identifier) ?? []).filter((t) => t > cutoff);

    if (prev.length >= this.maxRequests) {
      const oldest = prev[0] ?? now;
      return {
        success: false,
        limit: this.maxRequests,
        remaining: 0,
        reset: oldest + this.windowMs,
      };
    }

    prev.push(now);
    this.hits.set(identifier, prev);
    return {
      success: true,
      limit: this.maxRequests,
      remaining: Math.max(0, this.maxRequests - prev.length),
      reset: now + this.windowMs,
    };
  }

  public resetAll(): void {
    this.hits.clear();
  }
}

function createLimiter(
  prefix: string,
  tokens: number,
  windowStr: `${number} s` | `${number} m` | `${number} h`,
  windowMs: number,
): RateLimiterLike {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  const isDummyUrl =
    !url ||
    url.includes('sintetis') ||
    url.includes('example-synthetic') ||
    url.includes('dummy');
  const isDummyToken = !token || token.startsWith('dummy_');

  if (url && token && !isDummyUrl && !isDummyToken) {
    try {
      const redis = new Redis({ url, token });
      const rl = new Ratelimit({
        redis,
        prefix,
        limiter: Ratelimit.slidingWindow(tokens, windowStr),
      });
      return {
        async limit(identifier: string): Promise<RateLimitResult> {
          try {
            const res = await rl.limit(identifier);
            return {
              success: res.success,
              limit: res.limit,
              remaining: res.remaining,
              reset: res.reset,
            };
          } catch {
            return {
              success: true,
              limit: tokens,
              remaining: tokens,
              reset: Date.now() + windowMs,
            };
          }
        },
      };
    } catch {
      // Fallback ke in-memory jika inisialisasi Redis gagal
    }
  }

  return new InMemorySlidingWindowLimiter(tokens, windowMs);
}

export const loginLimiter: RateLimiterLike = createLimiter(
  'rl:login',
  5,
  '15 m',
  15 * 60 * 1000,
);
export const mfaLimiter: RateLimiterLike = createLimiter(
  'rl:mfa',
  5,
  '10 m',
  10 * 60 * 1000,
);
export const uploadLimiter: RateLimiterLike = createLimiter(
  'rl:upload',
  30,
  '10 m',
  10 * 60 * 1000,
);
export const extractLimiter: RateLimiterLike = createLimiter(
  'rl:extract',
  20,
  '10 m',
  10 * 60 * 1000,
);
export const apiLimiter: RateLimiterLike = createLimiter(
  'rl:api',
  120,
  '1 m',
  60 * 1000,
);
