import { NextResponse } from "next/server";
import { clientKey, createRateLimiter } from "./rate-limit";

export function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

/** Ограничитель частоты для публичной точки входа. Возвращает готовый ответ 429 или null. */
export function rateGuard(limitPerMinute: number) {
  const check = createRateLimiter(limitPerMinute, 60_000);
  return (request: Request) => {
    const rate = check(clientKey(request.headers));
    return rate.allowed
      ? null
      : json({ error: "Слишком много запросов. Повторите через минуту." }, 429, { "Retry-After": String(rate.retryAfterSeconds) });
  };
}

export async function readJson(request: Request, maxBytes: number): Promise<{ body: unknown } | { error: NextResponse }> {
  const raw = await request.text();
  if (raw.length > maxBytes) return { error: json({ error: "Запрос слишком большой." }, 413) };
  try {
    return { body: JSON.parse(raw) };
  } catch {
    return { error: json({ error: "Запрос должен быть в формате JSON." }, 400) };
  }
}
