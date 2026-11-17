import { describe, expect, it } from "vitest";
import { compensationLines, formatAmount, formatExperience, formatHeadcount, renderVacancyText } from "@/domain/vacancy/format";
import { applyPatch } from "@/domain/vacancy/merge";
import { parseEmployerMessage } from "@/domain/vacancy/parse";
import { emptyDraft } from "@/domain/vacancy/schema";

const plain = (value: string | null) => value?.replace(/ /g, " ");

describe("форматирование", () => {
  it("склоняет количество людей", () => {
    expect([1, 2, 5, 11, 21, 22].map((n) => plain(formatHeadcount(n)))).toEqual([
      "1 человек", "2 человека", "5 человек", "11 человек", "21 человек", "22 человека",
    ]);
  });

  it("суммы: точная, вилка, открытые границы", () => {
    const base = { currency: "KZT", period: "month" } as const;
    expect(plain(formatAmount({ ...base, amountFrom: 300000, amountTo: 300000 }))).toBe("300 000 ₸ в месяц");
    expect(plain(formatAmount({ ...base, amountFrom: 250000, amountTo: 350000 }))).toBe("250 000 – 350 000 ₸ в месяц");
    expect(plain(formatAmount({ ...base, amountFrom: 500000, amountTo: null }))).toBe("от 500 000 ₸ в месяц");
    expect(formatAmount({ ...base, amountFrom: null, amountTo: null })).toBeNull();
  });

  it("несколько вариантов оплаты перечисляются", () => {
    const lines = compensationLines({ ...emptyDraft().compensation, models: ["fixed_plus_bonus", "commission"] });
    expect(lines[0]).toMatch(/^Варианты: оклад \+ % от результата; сдельная оплата/);
  });

  it("опыт", () => {
    expect(formatExperience({ experienceRequired: null, experienceMinYears: null })).toBeNull();
    expect(formatExperience({ experienceRequired: false, experienceMinYears: null })).toBe("Не обязателен");
    expect(plain(formatExperience({ experienceRequired: true, experienceMinYears: 3 }))).toBe("От 3 лет");
  });

  it("текст вакансии для публикации", () => {
    const draft = applyPatch(
      emptyDraft(),
      parseEmployerMessage(
        "Мне нужны два бариста в Астане, зарплата 300 000 тенге, график 5/2. Опыт необязателен. " +
          "Обязанности: приготовление кофе, работа с гостями. Предварительное ИИ-интервью включено.",
      ).patch,
    );
    const text = renderVacancyText(draft);
    expect(text).toContain("Бариста, Астана");
    expect(text).toContain("Оплата: 300 000 ₸ в месяц");
    expect(text).toContain("— Приготовление кофе");
    expect(text).toContain("только с вашего согласия");
    expect(text).not.toMatch(/ /);
  });
});

describe("слияние изменений", () => {
  it("списки без повторов, защищённые признаки отфильтрованы", () => {
    const draft = applyPatch(emptyDraft(), { requirements: ["Знание кассы", "знание кассы", "Только девушки"] });
    expect(draft.requirements).toEqual(["Знание кассы"]);
  });

  it("верхняя граница не может быть меньше нижней", () => {
    const draft = applyPatch(emptyDraft(), { compensation: { amountFrom: 400000, amountTo: 300000 } });
    expect(draft.compensation.amountTo).toBe(400000);
  });

  it("«опыт не обязателен» сбрасывает минимальный стаж", () => {
    const draft = applyPatch(applyPatch(emptyDraft(), { experienceRequired: true, experienceMinYears: 3 }), { experienceRequired: false });
    expect(draft.experienceMinYears).toBeNull();
  });
});

describe("пометка о вариантах оплаты", () => {
  it("снимается, когда варианты выбраны", () => {
    const open = applyPatch(emptyDraft(), parseEmployerMessage("Ищем менеджера по продажам в Астане. Рассматриваем разные варианты оплаты.").patch);
    expect(open.compensation.note).toBe("Готовы обсуждать разные варианты оплаты");
    const chosen = applyPatch(open, { compensation: { models: ["fixed_plus_bonus"] } }, { models: "union" });
    expect(chosen.compensation.note).toBeNull();
  });

  it("собственное пояснение работодателя сохраняется", () => {
    const draft = applyPatch(emptyDraft(), { compensation: { models: ["fixed_plus_bonus"], note: "10% от продаж" } });
    expect(applyPatch(draft, { compensation: { models: ["fixed"] } }).compensation.note).toBe("10% от продаж");
  });
});
