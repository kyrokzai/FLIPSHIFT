import { describe, expect, it } from "vitest";
import { describePatch } from "@/domain/vacancy/format";
import { isSalesRole, parseEmployerMessage } from "@/domain/vacancy/parse";

const parse = (text: string, hasTitle = false) => parseEmployerMessage(text, { hasTitle }).patch;

describe("сценарий: кофейня", () => {
  const text =
    "Мне нужны два бариста в Астане, зарплата 300 000 тенге, график 5/2. Опыт необязателен. " +
    "Обязанности: приготовление кофе, работа с гостями, кассой и чистота рабочего места. " +
    "Предварительное ИИ-интервью включено.";
  const patch = parse(text);

  it("понимает должность, количество и город", () => {
    expect(patch.title).toBe("Бариста");
    expect(patch.headcount).toBe(2);
    expect(patch.city).toBe("Астана");
  });

  it("понимает зарплату и график", () => {
    expect(patch.compensation).toMatchObject({ amountFrom: 300000, amountTo: 300000, currency: "KZT", models: ["fixed"] });
    expect(patch.schedule).toBe("5/2");
    expect(patch.employmentType).toBe("full_time");
  });

  it("понимает опыт, обязанности и ИИ-интервью", () => {
    expect(patch.experienceRequired).toBe(false);
    expect(patch.responsibilities).toEqual([
      "Приготовление кофе",
      "Работа с гостями",
      "Работа с кассой",
      "Чистота рабочего места",
    ]);
    expect(patch.aiInterview).toBe(true);
  });

  it("короткий запрос из ТЗ даёт основу вакансии", () => {
    const short = parse("Мне нужны два бариста в Астане, зарплата 300 000 тенге, график 5/2");
    expect(describePatch(short).map((chip) => chip.label.replace(/ /g, " "))).toEqual([
      "Бариста",
      "2 человека",
      "Астана",
      "300 000 ₸ в месяц",
      "График 5/2",
      "Полная занятость",
    ]);
  });
});

describe("сценарий: мебельная компания", () => {
  const patch = parse(
    "Мебельная компания в Астане ищет менеджера по активным продажам готовой мебели и мебели на заказ. " +
      "Требуется самостоятельный поиск клиентов, B2B-продажи, переговоры и заключение сделок. " +
      "Рассматриваем разные варианты оплаты.",
  );

  it("понимает должность, город и тип бизнеса", () => {
    expect(patch.title).toBe("Менеджер по активным продажам готовой мебели и мебели на заказ");
    expect(patch.city).toBe("Астана");
    expect(patch.business).toBe("Мебельная компания");
    expect(isSalesRole(patch.title ?? null)).toBe(true);
  });

  it("выделяет обязанности из предложения без метки", () => {
    expect(patch.responsibilities).toEqual([
      "Самостоятельный поиск клиентов",
      "B2B-продажи",
      "Переговоры",
      "Заключение сделок",
    ]);
  });

  it("не выдумывает сумму и отмечает готовность обсуждать оплату", () => {
    expect(patch.compensation?.amountFrom).toBeUndefined();
    expect(patch.compensation?.models).toBeUndefined();
    expect(patch.compensation?.note).toBe("Готовы обсуждать разные варианты оплаты");
  });
});

describe("разные отрасли и формулировки", () => {
  it("вилка зарплаты с общим множителем и процентом", () => {
    const patch = parse("Ищем продавца-консультанта в магазин одежды в Алматы, оклад 250-350 тыс + процент, 2/2, опыт от 1 года");
    expect(patch.title).toBe("Продавец-консультант");
    expect(patch.business).toBe("Магазин одежды");
    expect(patch.compensation).toMatchObject({ amountFrom: 250000, amountTo: 350000, models: ["fixed_plus_bonus"] });
    expect(patch.schedule).toBe("2/2");
    expect(patch).toMatchObject({ experienceRequired: true, experienceMinYears: 1 });
  });

  it("составное название, удалёнка и сокращение «к»", () => {
    const patch = parse("нужен SMM-менеджер удаленно, 400к, частичная занятость");
    expect(patch).toMatchObject({ title: "SMM-менеджер", workFormat: "remote", employmentType: "part_time" });
    expect(patch.compensation?.amountFrom).toBe(400000);
  });

  it("нижняя граница зарплаты, опыт и требование", () => {
    const patch = parse("Требуется главный бухгалтер, Караганда, от 500 000 тг, опыт от 5 лет, знание 1С обязательно");
    expect(patch.title).toBe("Главный бухгалтер");
    expect(patch.compensation).toMatchObject({ amountFrom: 500000, amountTo: null });
    expect(patch.experienceMinYears).toBe(5);
    expect(patch.requirements).toEqual(["Знание 1С"]);
  });

  it("оплата за смену и часы работы", () => {
    const patch = parse("Ищу 3 поваров в ресторан в Шымкенте, сменный график с 10 до 22, 15000 тенге за смену");
    expect(patch).toMatchObject({ title: "Повар", headcount: 3, city: "Шымкент", schedule: "Сменный, 10:00–22:00" });
    expect(patch.compensation).toMatchObject({ amountFrom: 15000, period: "shift" });
  });

  it("должность вне справочника приводится к начальной форме", () => {
    expect(parse("Срочно ищем фрезеровщика в Павлодаре, зп 450 тысяч").title).toBe("Фрезеровщик");
    expect(parse("Нужны пять укладчиков, Астана").title).toBe("Укладчик");
  });

  it("миллионы и латиница в названии", () => {
    const patch = parse("Python разработчик, удалёнка, от 1,5 млн тенге, опыт 3+ года");
    expect(patch.title).toBe("Python разработчик");
    expect(patch.compensation?.amountFrom).toBe(1_500_000);
    expect(patch.experienceMinYears).toBe(3);
  });

  it("не принимает «человека» за должность", () => {
    const patch = parse("Нужен человек на склад");
    expect(patch.title).toBeUndefined();
    expect(patch.business).toBe("Склад");
  });

  it("не путает график, часы и количество людей с зарплатой", () => {
    const patch = parse("Нужны 2 кассира, график 5/2 с 9 до 18");
    expect(patch.compensation).toBeUndefined();
    expect(patch.schedule).toBe("5/2, 9:00–18:00");
    expect(patch.headcount).toBe(2);
  });

  it("российский город без валюты — рубли", () => {
    expect(parse("Нужен курьер в Москве, зарплата 90 000").compensation?.currency).toBe("RUB");
  });
});

describe("правки к существующей вакансии", () => {
  it("меняет зарплату и график, не трогая должность", () => {
    const patch = parse("измени зарплату на 350 тысяч и график 2/2", true);
    expect(patch.title).toBeUndefined();
    expect(patch.compensation?.amountFrom).toBe(350000);
    expect(patch.schedule).toBe("2/2");
  });

  it("«нужен опыт от года» — это про опыт, а не новая должность", () => {
    const patch = parse("нужен опыт от года", true);
    expect(patch.title).toBeUndefined();
    expect(patch).toMatchObject({ experienceRequired: true, experienceMinYears: 1 });
  });

  it("отключает ИИ-интервью", () => {
    expect(parse("ИИ-интервью не нужно", true).aiInterview).toBe(false);
  });
});
