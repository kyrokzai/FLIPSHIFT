import { TurnRequestSchema, generateClientTurn } from "@/server/agents/challenge-llm";
import { json, rateGuard, readJson } from "@/server/http";
import { getLlmProvider } from "@/server/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const guard = rateGuard(30);

/**
 * Следующая реплика ИИ-собеседника. Без подключённой модели — честный отказ:
 * интерфейс в этом случае предлагает только сценарий по шаблону.
 */
export async function POST(request: Request) {
  const limited = guard(request);
  if (limited) return limited;

  const llm = getLlmProvider();
  if (!llm) return json({ error: "Языковая модель не подключена. Доступен сценарий по шаблону." }, 503);

  const read = await readJson(request, 64 * 1024);
  if ("error" in read) return read.error;
  const parsed = TurnRequestSchema.safeParse(read.body);
  if (!parsed.success) return json({ error: "Не удалось прочитать запрос." }, 400);

  try {
    const message = await generateClientTurn(llm, parsed.data);
    if (!message) return json({ error: "Модель не ответила. Продолжите по сценарию." }, 502);
    return json({ message });
  } catch {
    console.error("[challenge] Сбой генерации реплики");
    return json({ error: "Модель не ответила. Продолжите по сценарию." }, 502);
  }
}
