import type { z } from "zod";

/**
 * Единая точка подключения языковой модели. Все агенты обращаются к LLM
 * только через этот интерфейс, поэтому поставщика можно сменить, не трогая
 * логику найма.
 */

export interface StructuredRequest<T> {
  /** Постоянная инструкция — кэшируется на стороне поставщика. */
  system: string;
  /** Изменяемая часть запроса. */
  prompt: string;
  schema: z.ZodType<T>;
}

export interface LlmProvider {
  readonly name: string;
  readonly model: string;
  /** Возвращает проверенный объект или null, если модель не дала пригодного ответа. */
  generateObject<T>(request: StructuredRequest<T>): Promise<T | null>;
}
