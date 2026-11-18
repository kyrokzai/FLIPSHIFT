import { NextResponse } from "next/server";
import { IntakeRequestSchema } from "@/domain/vacancy/schema";
import { handleVacancyIntake } from "@/server/agents/orchestrator";
import { getLlmProvider } from "@/server/llm";
import { clientKey, createRateLimiter } from "@/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 32 * 1024;
const limit = Number(process.env.INTAKE_RATE_LIMIT_PER_MINUTE) > 0 ? Number(process.env.INTAKE_RATE_LIMIT_PER_MINUTE) : 20;
const checkRate = createRateLimiter(limit, 60_000);

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

/**
 * Публичная точка входа: черновик вакансии создаётся без регистрации.
 * Здесь нет доступа к данным кандидатов и организаций — только разбор текста.
 */
export async function POST(request: Request) {
  const rate = checkRate(clientKey(request.headers));
  if (!rate.allowed) {
    return json(
      { error: "Слишком много запросов. Повторите через минуту." },
      429,
      { "Retry-After": String(rate.retryAfterSeconds) },
    );
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return json({ error: "Запрос слишком большой." }, 413);
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "Запрос должен быть в формате JSON." }, 400);
  }

  const parsed = IntakeRequestSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    // Наружу уходят только наши собственные тексты о длине сообщения, а не служебные сообщения валидатора.
    const ownText = first?.path[0] === "message" && (first.code === "too_small" || first.code === "too_big");
    const message = ownText ? first.message : "Не удалось прочитать запрос.";
    return json({ error: message }, 400);
  }

  try {
    const result = await handleVacancyIntake(parsed.data, { llm: getLlmProvider() });
    return json(result);
  } catch {
    console.error("[intake] Сбой при разборе вакансии");
    return json({ error: "Не удалось разобрать запрос. Попробуйте ещё раз." }, 500);
  }
}
