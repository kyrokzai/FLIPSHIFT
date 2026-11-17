/**
 * Ограничение частоты публичных запросов по IP: фиксированное окно в памяти процесса.
 * Этого достаточно для одного экземпляра; при горизонтальном масштабировании
 * счётчики переедут в общее хранилище (этап H3).
 */

interface Bucket {
  count: number;
  resetAt: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export function createRateLimiter(limit: number, windowMs: number, now: () => number = Date.now) {
  const buckets = new Map<string, Bucket>();

  return function check(key: string): RateLimitResult {
    const time = now();
    if (buckets.size > 5_000) {
      for (const [k, bucket] of buckets) if (bucket.resetAt <= time) buckets.delete(k);
    }

    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= time) {
      buckets.set(key, { count: 1, resetAt: time + windowMs });
      return { allowed: true, retryAfterSeconds: 0 };
    }
    if (bucket.count >= limit) {
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - time) / 1000)) };
    }
    bucket.count++;
    return { allowed: true, retryAfterSeconds: 0 };
  };
}

export function clientKey(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip") || "unknown";
}
