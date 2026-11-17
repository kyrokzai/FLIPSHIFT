import { json } from "@/server/http";
import { getLlmProvider } from "@/server/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Что включено в этой установке. Интерфейс по этому ответу решает, где
 * анализировать резюме: в браузере или на сервере с языковой моделью.
 * Секретов в ответе нет.
 */
export async function GET() {
  return json({ llm: getLlmProvider() !== null });
}
