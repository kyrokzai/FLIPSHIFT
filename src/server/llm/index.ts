import { DEFAULT_ANTHROPIC_MODEL, createAnthropicProvider } from "./anthropic";
import type { LlmProvider } from "./provider";

export type { LlmProvider, StructuredRequest } from "./provider";

let cached: LlmProvider | null | undefined;

/**
 * Поставщик LLM из настроек окружения. null — модель не подключена,
 * платформа работает на встроенном движке разбора.
 *
 * Платный API включается только явно: AI_PROVIDER=anthropic.
 */
export function getLlmProvider(): LlmProvider | null {
  if (cached !== undefined) return cached;

  const provider = (process.env.AI_PROVIDER ?? "rules").trim().toLowerCase();
  if (provider === "anthropic") {
    if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
      console.warn("[llm] AI_PROVIDER=anthropic, но ключ не задан — работает встроенный движок");
      cached = null;
    } else {
      cached = createAnthropicProvider(process.env.AI_MODEL?.trim() || DEFAULT_ANTHROPIC_MODEL);
    }
  } else {
    cached = null;
  }
  return cached;
}

/** Для тестов: сбросить кэш после изменения окружения. */
export function resetLlmProvider(): void {
  cached = undefined;
}
