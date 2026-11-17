import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { LlmProvider, StructuredRequest } from "./provider";

export const DEFAULT_ANTHROPIC_MODEL = "claude-opus-5-5";

/**
 * Адаптер Claude. Один вызов на сообщение работодателя, ответ — строго по схеме.
 * Низкий уровень effort: задача — извлечение полей, а не рассуждение.
 */
export function createAnthropicProvider(model: string = DEFAULT_ANTHROPIC_MODEL): LlmProvider {
  // Ключ берётся из окружения (ANTHROPIC_API_KEY). В коде и в Git его нет.
  const client = new Anthropic({ timeout: 25_000, maxRetries: 1 });

  return {
    name: "anthropic",
    model,
    async generateObject<T>({ system, prompt, schema }: StructuredRequest<T>): Promise<T | null> {
      try {
        const message = await client.beta.messages.parse({
          model,
          max_tokens: 8000,
          // Если модель отклонит запрос по политике, API сам повторит его на запасной модели.
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
          messages: [{ role: "user", content: prompt }],
          output_config: { effort: "low", format: betaZodOutputFormat(schema) },
        });

        if (message.stop_reason === "refusal" || message.stop_reason === "max_tokens") return null;
        return message.parsed_output ?? null;
      } catch (error) {
        // В журнал попадает только тип сбоя — без текста работодателя и персональных данных.
        if (error instanceof Anthropic.AuthenticationError) {
          console.error("[llm] Anthropic: ключ API отклонён");
        } else if (error instanceof Anthropic.RateLimitError) {
          console.error("[llm] Anthropic: превышен лимит запросов");
        } else if (error instanceof Anthropic.APIError) {
          console.error(`[llm] Anthropic: ошибка API ${error.status ?? "без статуса"}`);
        } else {
          console.error("[llm] Anthropic: ответ не разобран");
        }
        return null;
      }
    },
  };
}
