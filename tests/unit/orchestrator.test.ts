import { describe, expect, it, vi } from "vitest";
import { INTAKE_SYSTEM_PROMPT, llmVacancyToPatch, type LlmVacancy } from "@/server/agents/intake-llm";
import { handleVacancyIntake } from "@/server/agents/orchestrator";
import { AGENTS } from "@/server/agents/registry";
import type { LlmProvider, StructuredRequest } from "@/server/llm";

const emptyLlm: LlmVacancy = {
  title: null, headcount: null, city: null, business: null, employmentType: null, workFormat: null, schedule: null,
  compensationModels: null, amountFrom: null, amountTo: null, currency: null, period: null, compensationNote: null,
  experienceRequired: null, experienceMinYears: null, responsibilities: null, requirements: null, conditions: null,
  aiInterview: null, excludedCriteria: [],
};

function fakeLlm(result: LlmVacancy | null) {
  const generateObject = vi.fn(async (request: StructuredRequest<unknown>) => {
    void request;
    return result;
  });
  return { provider: { name: "fake", model: "fake-1", generateObject } as unknown as LlmProvider, generateObject };
}

describe("Orchestrator Agent: приём вакансии", () => {
  it("без модели собирает черновик встроенным движком", async () => {
    const result = await handleVacancyIntake(
      { message: "Мне нужны два бариста в Астане, зарплата 300 000 тенге, график 5/2" },
      { llm: null },
    );
    expect(result.engine).toBe("rules");
    expect(result.draft).toMatchObject({ title: "Бариста", headcount: 2, city: "Астана", schedule: "5/2" });
    expect(result.reply).toContain("Собрал черновик вакансии: «Бариста»");
    expect(result.questions.map((q) => q.id)).toEqual(["experience", "responsibilities", "ai_interview"]);
  });

  it("с моделью: один вызов, результат модели уточняет разбор", async () => {
    const { provider, generateObject } = fakeLlm({
      ...emptyLlm,
      title: "Менеджер по активным продажам мебели",
      requirements: ["Опыт B2B-продаж"],
    });
    const result = await handleVacancyIntake(
      { message: "Мебельная компания в Астане ищет менеджера по активным продажам готовой мебели и мебели на заказ." },
      { llm: provider },
    );
    expect(generateObject).toHaveBeenCalledTimes(1);
    expect(result.engine).toBe("llm");
    expect(result.draft.title).toBe("Менеджер по активным продажам мебели");
    expect(result.draft.city).toBe("Астана"); // поле из встроенного разбора сохранено
    expect(result.draft.requirements).toEqual(["Опыт B2B-продаж"]);
  });

  it("модель получает черновик и сообщение как данные, без секретов", async () => {
    const { provider, generateObject } = fakeLlm(emptyLlm);
    await handleVacancyIntake({ message: "Нужен бариста в Астане" }, { llm: provider });
    const request = generateObject.mock.calls[0]![0];
    expect(request.system).toBe(INTAKE_SYSTEM_PROMPT);
    expect(request.prompt).toContain("<message>\nНужен бариста в Астане\n</message>");
    expect(request.prompt).toContain('"title":"Бариста"');
  });

  it("если модель не ответила, остаётся встроенный разбор", async () => {
    const { provider } = fakeLlm(null);
    const result = await handleVacancyIntake({ message: "Нужен бариста в Астане" }, { llm: provider });
    expect(result.engine).toBe("rules");
    expect(result.draft.title).toBe("Бариста");
  });

  it("ответ на вопрос обрабатывается без вызова модели", async () => {
    const { provider, generateObject } = fakeLlm(emptyLlm);
    const first = await handleVacancyIntake({ message: "Нужен бариста в Астане" }, { llm: null });
    const result = await handleVacancyIntake(
      { message: "350 тысяч", draft: first.draft, questionId: "compensation_amount" },
      { llm: provider },
    );
    expect(generateObject).not.toHaveBeenCalled();
    expect(result.draft.compensation.amountFrom).toBe(350000);
    expect(result.reply).toMatch(/^Записал: оплата/);
  });

  it("правка, написанная вместо ответа, идёт как обычное сообщение", async () => {
    const first = await handleVacancyIntake({ message: "Нужен бариста в Астане, 5/2" }, { llm: null });
    const result = await handleVacancyIntake(
      { message: "измени график на 2/2", draft: first.draft, questionId: "compensation_amount" },
      { llm: null },
    );
    expect(result.draft.schedule).toBe("2/2");
    expect(result.draft.compensation.note).toBeNull();
  });

  it("защищённые признаки: предупреждение есть, в вакансии их нет", async () => {
    const { provider } = fakeLlm({
      ...emptyLlm,
      requirements: ["Только девушки", "Знание кассы"],
      excludedCriteria: [{ attribute: "gender", excerpt: "девушка" }],
    });
    const result = await handleVacancyIntake(
      { message: "Нужна девушка до 30 лет на ресепшн в салон красоты в Алматы" },
      { llm: provider },
    );
    expect(result.notices.map((n) => n.attribute).sort()).toEqual(["age", "gender"]);
    expect(result.draft.requirements).toEqual(["Знание кассы"]);
    expect(JSON.stringify(result.draft)).not.toMatch(/девушк/i);
  });

  it("сообщение без условий не ломает вакансию", async () => {
    const first = await handleVacancyIntake({ message: "Нужен бариста в Астане" }, { llm: null });
    const result = await handleVacancyIntake({ message: "спасибо, пока всё", draft: first.draft }, { llm: null });
    expect(result.draft).toEqual(first.draft);
    expect(result.reply).toContain("Не нашёл в сообщении новых условий");
  });
});

describe("ответ модели → изменение вакансии", () => {
  it("отбрасывает бессмысленные числа", () => {
    const converted = llmVacancyToPatch({ ...emptyLlm, headcount: 0, amountFrom: -5, experienceMinYears: 99 });
    expect(converted?.patch).toEqual({});
  });

  it("обрезает слишком длинные строки", () => {
    const converted = llmVacancyToPatch({ ...emptyLlm, title: "а".repeat(500) });
    expect(converted?.patch.title).toHaveLength(160);
  });
});

describe("реестр агентов", () => {
  it("описывает пять агентов, активен только Orchestrator", () => {
    expect(Object.keys(AGENTS)).toEqual(["orchestrator", "sourcer", "scout", "interviewer", "coordinator"]);
    expect(Object.values(AGENTS).filter((agent) => agent.status === "active").map((a) => a.id)).toEqual(["orchestrator"]);
  });
});
