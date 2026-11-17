import { describe, expect, it } from "vitest";
import { applyPatch } from "@/domain/vacancy/merge";
import { parseEmployerMessage } from "@/domain/vacancy/parse";
import { computeQuestions, interpretAnswer, isAnswerTo, missingForConfirmation } from "@/domain/vacancy/questions";
import { emptyDraft, type VacancyDraft } from "@/domain/vacancy/schema";

const draftFrom = (text: string): VacancyDraft => applyPatch(emptyDraft(), parseEmployerMessage(text).patch);
const ids = (draft: VacancyDraft, skipped = []) => computeQuestions(draft, skipped).map((q) => q.id);

describe("уточняющие вопросы", () => {
  it("кофейня: спрашивает только то, чего нет в запросе", () => {
    const draft = draftFrom("Мне нужны два бариста в Астане, зарплата 300 000 тенге, график 5/2");
    expect(ids(draft)).toEqual(["experience", "responsibilities", "ai_interview"]);
  });

  it("полный запрос не требует вопросов", () => {
    const draft = draftFrom(
      "Мне нужны два бариста в Астане, зарплата 300 000 тенге, график 5/2. Опыт необязателен. " +
        "Обязанности: приготовление кофе, работа с гостями. Предварительное ИИ-интервью включено.",
    );
    expect(ids(draft)).toEqual([]);
  });

  it("мебельная компания: сначала варианты оплаты, с множественным выбором", () => {
    const draft = draftFrom(
      "Мебельная компания в Астане ищет менеджера по активным продажам готовой мебели и мебели на заказ. Рассматриваем разные варианты оплаты.",
    );
    const [first] = computeQuestions(draft);
    expect(first?.id).toBe("compensation_models");
    expect(first?.mode).toBe("multi");
    expect(first?.options.map((o) => o.label)).toContain("Оклад + % от продаж");
  });

  it("выбранные варианты оплаты объединяются, затем спрашивается сумма", () => {
    let draft = draftFrom("Ищем менеджера по продажам в Астане");
    const question = computeQuestions(draft)[0]!;
    for (const option of question.options.slice(0, 2)) draft = applyPatch(draft, option.patch, { models: "union" });
    expect(draft.compensation.models).toEqual(["fixed_plus_bonus", "commission"]);
    expect(ids(draft)[0]).toBe("compensation_amount");
  });

  it("«по договорённости» снимает вопрос о сумме", () => {
    const draft = applyPatch(draftFrom("Нужен бариста в Астане"), { compensation: { models: ["negotiable"] } });
    expect(ids(draft)).not.toContain("compensation_amount");
  });

  it("пропущенный вопрос больше не задаётся", () => {
    const draft = draftFrom("Мне нужны два бариста в Астане, зарплата 300 000 тенге, график 5/2");
    expect(computeQuestions(draft, ["responsibilities"]).map((q) => q.id)).toEqual(["experience", "ai_interview"]);
  });

  it("для удалённой работы город не обязателен", () => {
    const draft = draftFrom("нужен SMM-менеджер удаленно, 400к");
    expect(ids(draft)).not.toContain("city");
    expect(missingForConfirmation(draft)).toEqual([]);
  });

  it("без должности и города вакансию подтвердить нельзя", () => {
    expect(missingForConfirmation(emptyDraft())).toEqual(["должность", "город"]);
  });

  it("предлагает типовые обязанности для известной должности", () => {
    const question = computeQuestions(draftFrom("Нужен бариста в Астане")).find((q) => q.id === "responsibilities");
    expect(question?.options[0]?.patch.responsibilities?.length).toBeGreaterThan(2);
  });
});

describe("свободные ответы на вопросы", () => {
  const draft = draftFrom("Ищем менеджера по продажам в Астане");

  it("сумма без валюты и слов «зарплата»", () => {
    const withModels = applyPatch(draft, { compensation: { models: ["fixed_plus_bonus", "commission"] } });
    const patch = interpretAnswer(withModels, "compensation_amount", "от 300 до 500 тысяч");
    expect(patch.compensation).toMatchObject({ amountFrom: 300000, amountTo: 500000 });
    // Сумма не отменяет выбранные ранее варианты оплаты.
    expect(patch.compensation?.models).toEqual(["fixed_plus_bonus", "commission"]);
  });

  it("город вне справочника записывается как есть", () => {
    expect(interpretAnswer(emptyDraft(), "city", "Риддер").city).toBe("Риддер");
    expect(interpretAnswer(emptyDraft(), "city", "в Алматы").city).toBe("Алматы");
  });

  it("опыт: числа словами и отказ", () => {
    expect(interpretAnswer(draft, "experience", "да, от двух лет")).toMatchObject({ experienceRequired: true, experienceMinYears: 2 });
    expect(interpretAnswer(draft, "experience", "нет")).toMatchObject({ experienceRequired: false });
  });

  it("обязанности: перечисление становится списком и не меняет другие поля", () => {
    const patch = interpretAnswer(draft, "responsibilities", "доставка заказов по Алматы, приём оплаты");
    expect(patch).toEqual({ responsibilities: ["Доставка заказов по Алматы", "Приём оплаты"] });
  });

  it("ИИ-интервью: да и нет", () => {
    expect(interpretAnswer(draft, "ai_interview", "да, давайте").aiInterview).toBe(true);
    expect(interpretAnswer(draft, "ai_interview", "не нужно").aiInterview).toBe(false);
  });

  it("правка вместо ответа распознаётся как обычное сообщение", () => {
    expect(isAnswerTo(draft, "schedule", "измени зарплату на 350 тысяч")).toBe(false);
    expect(isAnswerTo(draft, "schedule", "зарплата 350 тысяч")).toBe(false);
    expect(isAnswerTo(draft, "schedule", "2/2")).toBe(true);
    expect(isAnswerTo(draft, "schedule", "по будням")).toBe(true);
  });
});
