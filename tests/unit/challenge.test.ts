import { describe, expect, it } from "vitest";
import { demoAnswer } from "@/domain/challenge/demo-answers";
import { createTurn, evaluateChallenge, levelLabels, nextSituation, pickSituations, plannedSituations, validateSetup, weightedShare, weightsFor } from "@/domain/challenge/engine";
import type { Challenge, TemplateId } from "@/domain/challenge/schema";
import { TEMPLATES, suggestTemplate } from "@/domain/challenge/templates";

function run(templateId: TemplateId, answers: (step: number, situationId: string) => string, stepCount = 7, difficulty: Challenge["difficulty"] = "standard"): Challenge {
  let challenge: Challenge = {
    id: "c1", candidateId: "x", mode: "demo", templateId, difficulty, engine: "scripted", stepCount, customSituations: [],
    status: "in_progress", consent: null, turns: [], report: null, createdAt: 0, updatedAt: 0,
  };
  for (let situation = nextSituation(challenge); situation; situation = nextSituation(challenge)) {
    const turn = createTurn(situation, difficulty);
    const step = challenge.turns.length + 1;
    challenge = { ...challenge, turns: [...challenge.turns, { ...turn, answer: answers(step, situation.id), answeredAt: step }] };
  }
  return challenge;
}

const level = (c: Challenge, id: string) => evaluateChallenge(c, 0).results.find((r) => r.criterionId === id)!;

describe("шаблоны и ход сценария", () => {
  it("все шаблоны используют один движок и разумный набор данных", () => {
    for (const template of Object.values(TEMPLATES)) {
      expect(template.criteria.length).toBeGreaterThanOrEqual(3);
      if (template.id !== "custom") expect(template.situations.length).toBeGreaterThanOrEqual(5);
    }
  });

  it("первый вопрос продаж — ресторан на 80 мест и три поставщика", () => {
    expect(TEMPLATES.sales.situations[0]!.prompts.standard).toContain("80 посадочных мест");
    expect(TEMPLATES.sales.situations[0]!.prompts.standard).toContain("трёх поставщиков");
  });

  it("при сокращении шагов сохраняются начало и завершение разговора", () => {
    const picked = pickSituations(TEMPLATES.sales.situations, 3).map((s) => s.id);
    expect(picked).toEqual(["open", "deadline", "proposal"]);
    expect(pickSituations(TEMPLATES.sales.situations, 5)).toHaveLength(5);
  });

  it("сценарий заканчивается ровно через выбранное число шагов", () => {
    expect(run("sales", () => "Ответ", 4).turns).toHaveLength(4);
    expect(run("sales", () => "Ответ", 7).turns).toHaveLength(7);
  });

  it("сложность меняет реплики, а не критерии", () => {
    expect(run("sales", () => "x", 3, "hard").turns[0]!.prompt).toContain("две минуты");
    expect(run("sales", () => "x", 3, "easy").turns[0]!.prompt).not.toContain("трёх поставщиков");
  });

  it("проверяет настройки", () => {
    expect(validateSetup({ templateId: "sales", stepCount: 8, customSituations: [] })).toMatch(/от 3 до 7/);
    expect(validateSetup({ templateId: "barista", stepCount: 7, customSituations: [] })).toMatch(/не больше 5/);
    expect(validateSetup({ templateId: "custom", stepCount: 3, customSituations: [] })).toMatch(/хотя бы 3/);
    expect(validateSetup({ templateId: "sales", stepCount: 5, customSituations: [] })).toBeNull();
  });

  it("свой сценарий работодателя идёт по его ситуациям", () => {
    const custom = [1, 2, 3].map((i) => ({ id: `s${i}`, title: `Ситуация ${i}`, prompt: `Опишите ваши действия в ситуации номер ${i}.` }));
    const c: Challenge = { ...run("sales", () => "x", 3), templateId: "custom", customSituations: custom, turns: [] };
    expect(plannedSituations(c).map((s) => s.id)).toEqual(["s1", "s2", "s3"]);
  });

  it("подбирает шаблон по должности", () => {
    expect(suggestTemplate("Менеджер по активным продажам мебели")).toBe("sales");
    expect(suggestTemplate("Бариста")).toBe("barista");
    expect(suggestTemplate("Главный бухгалтер")).toBe("accountant");
    expect(suggestTemplate("Сварщик")).toBe("custom");
  });
});

describe("оценка ответов", () => {
  const strong = run("sales", (step, id) => demoAnswer("sales", id, step, "strong"));
  const weak = run("sales", (step, id) => demoAnswer("sales", id, step, "weak"));

  it("сильные ответы проявляют все навыки продаж", () => {
    for (const result of evaluateChallenge(strong, 0).results) expect(result.level, result.label).toBe("demonstrated");
  });

  it("слабые ответы — навыки не проявлены, а не «плохой кандидат»", () => {
    const report = evaluateChallenge(weak, 0);
    expect(report.results.filter((r) => r.level === "demonstrated")).toHaveLength(0);
    expect(level(weak, "needs").explanation).toContain("это не значит, что его нет");
  });

  it("у каждого вывода есть факты, дословная выдержка и что проверить", () => {
    for (const result of evaluateChallenge(strong, 0).results) {
      expect(result.facts.length).toBeGreaterThan(0);
      expect(result.excerpt).toBeTruthy();
      expect(strong.turns[result.excerptStep! - 1]!.answer!.replace(/\s+/g, " ")).toContain(result.excerpt!.replace(/…$/, ""));
      expect(result.toVerify.length).toBeGreaterThan(10);
    }
  });

  it("встроенная оценка никогда не заявляет высокую уверенность", () => {
    for (const result of [...evaluateChallenge(strong, 0).results, ...evaluateChallenge(weak, 0).results]) expect(result.confidence).not.toBe("high");
    expect(evaluateChallenge(weak, 0).results.every((r) => r.confidence === "low")).toBe(true);
  });

  it("возражения: учитывается и признание сути, и предложенный выход", () => {
    const onlyArgument = run("sales", (step, id) => (id === "open" || id === "proposal" ? "x" : "Цена такая за счёт материалов."));
    expect(level(onlyArgument, "objections").level).toBe("partial");
    expect(level(onlyArgument, "objections").facts.join(" ")).toContain("суть возражения не признана");
  });

  it("без ситуаций с возражением навык не оценивается, а не ставится ноль", () => {
    const custom = [1, 2, 3].map((i) => ({ id: `s${i}`, title: `S${i}`, prompt: `Ситуация номер ${i} для проверки.` }));
    let c: Challenge = { ...run("sales", () => "x", 3), templateId: "sales", turns: [] };
    c = { ...run("sales", (step, id) => demoAnswer("sales", id, step, "strong"), 3) };
    expect(evaluateChallenge(c, 0).results.find((r) => r.criterionId === "objections")!.level).toBe("demonstrated");
    const noAnswers: Challenge = { ...c, turns: c.turns.map((t) => ({ ...t, answer: null })), templateId: "custom", customSituations: custom };
    expect(evaluateChallenge(noAnswers, 0).results.every((r) => r.level === "not_assessed")).toBe(true);
  });

  it("следующий шаг в завершении разговора важнее упоминания по ходу", () => {
    const early = run("sales", (step) => (step === 1 ? "Завтра пришлю каталог." : "Хорошо."), 3);
    expect(level(early, "next_step").level).toBe("partial");
  });

  it("досрочное завершение: оценка по пройденным шагам", () => {
    const partial = { ...strong, turns: strong.turns.slice(0, 2) };
    const report = evaluateChallenge(partial, 0);
    expect(report.answeredSteps).toBe(2);
    expect(report.totalSteps).toBe(7);
  });

  it("веса работодателя меняют сводку, нулевой вес исключает критерий", () => {
    const report = evaluateChallenge(run("sales", (step, id) => demoAnswer("sales", id, step, "medium")), 0);
    const base = weightedShare(report, weightsFor("sales", {}))!;
    const onlyNeeds = weightedShare(report, Object.fromEntries(report.results.map((r) => [r.criterionId, r.criterionId === "needs" ? 3 : 0])))!;
    expect(base).toBeGreaterThan(0);
    expect(onlyNeeds).toBe(report.results.find((r) => r.criterionId === "needs")!.level === "demonstrated" ? 100 : onlyNeeds);
    expect(weightedShare(report, Object.fromEntries(report.results.map((r) => [r.criterionId, 0])))).toBeNull();
  });

  it("в критериях нет оценки личности и защищённых признаков", () => {
    const text = JSON.stringify(Object.values(TEMPLATES).map((t) => t.criteria.map((c) => [c.label, c.description])));
    expect(text).not.toMatch(/личност|харизм|эмоци|возраст|пол |внешн|акцент|уверенн\S* в себе/i);
  });

  it("все уровни подписаны по-русски", () => {
    expect(levelLabels.not_assessed).toBe("Не оценивалось");
  });
});
