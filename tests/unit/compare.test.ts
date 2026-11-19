import { describe, expect, it } from "vitest";
import { demoResumesFor } from "@/domain/candidate/demo";
import { analyzeResume } from "@/domain/candidate/match";
import type { Candidate } from "@/domain/candidate/schema";
import { demoAnswer } from "@/domain/challenge/demo-answers";
import { createTurn, evaluateChallenge, nextSituation } from "@/domain/challenge/engine";
import type { Challenge } from "@/domain/challenge/schema";
import { NO_DATA, buildComparison, fieldIds } from "@/domain/compare/compare";
import { applyPatch } from "@/domain/vacancy/merge";
import { parseEmployerMessage } from "@/domain/vacancy/parse";
import { emptyDraft } from "@/domain/vacancy/schema";

const NOW = new Date("2026-11-19T00:00:00Z");
const draft = applyPatch(
  emptyDraft(),
  parseEmployerMessage("Мебельная компания в Астане ищет менеджера по активным продажам готовой мебели и мебели на заказ. Требуется самостоятельный поиск клиентов, B2B-продажи, переговоры и заключение сделок. Зарплата от 300 до 500 тысяч, график 5/2").patch,
);
const make = (name: string, resumeText: string, id = name): Candidate => ({
  id, mode: "demo", addedAt: 1, resumeText, error: null, vacancyKey: null,
  source: { kind: "demo", label: "Демонстрационные данные", url: null, fileName: null },
  ...analyzeResume(draft, resumeText, { name, now: NOW }),
});
const pool = demoResumesFor(draft);
const pick = (name: string) => make(name, pool.find((r) => r.name === name)!.resumeText);
const [aidar, ruslan, aliya] = [pick("Айдар К."), pick("Руслан Т."), pick("Алия М.")];
const names = { [aidar.id]: "Айдар К.", [ruslan.id]: "Руслан Т.", [aliya.id]: "Алия М." };

function challengeFor(candidateId: string, tier: "strong" | "weak"): Challenge {
  let c: Challenge = { id: `ch-${candidateId}`, candidateId, mode: "demo", templateId: "sales", difficulty: "standard", engine: "scripted", stepCount: 5, customSituations: [], status: "in_progress", consent: null, turns: [], report: null, createdAt: 0, updatedAt: 1 };
  for (let s = nextSituation(c); s; s = nextSituation(c)) c = { ...c, turns: [...c.turns, { ...createTurn(s, "standard"), answer: demoAnswer("sales", s.id, c.turns.length + 1, tier), answeredAt: 1 }] };
  return { ...c, status: "completed", report: evaluateChallenge(c, 0) };
}

const compare = (candidates: Candidate[], challenges: Challenge[] = []) => buildComparison({ draft, candidates, challenges, weights: {}, names });
const cell = (result: ReturnType<typeof compare>, field: string, id: string) => result.fields.find((f) => f.id === field)!.cells.find((c) => c.candidateId === id)!;

describe("сравнение кандидатов", () => {
  const three = compare([aidar, ruslan, aliya], [challengeFor(aidar.id, "strong")]);

  it("все поля есть для каждого из трёх кандидатов в порядке добавления", () => {
    expect(three.fields.map((f) => f.id)).toEqual([...fieldIds]);
    for (const field of three.fields) expect(field.cells.map((c) => c.candidateId)).toEqual([aidar.id, ruslan.id, aliya.id]);
  });

  it("у каждого значения указан источник, неизвестное — null, а не ноль", () => {
    for (const field of three.fields) {
      for (const c of field.cells) {
        if (c.value === null) expect(c.source).toBeNull();
        else if (field.id !== "missing") expect(c.source, `${field.id}`).not.toBeNull();
        expect(c.value ?? "").not.toMatch(/^0\b/);
      }
    }
    expect(NO_DATA).toBe("Нет данных");
  });

  it("привлечение клиентов подтверждено выдержкой; отказ кандидата не считается опытом", () => {
    expect(cell(three, "prospecting", aidar.id)).toMatchObject({ value: "Указано в резюме", source: "resume" });
    expect(cell(three, "prospecting", aidar.id).excerpt).toContain("Самостоятельный поиск клиентов");
    expect(cell(three, "prospecting", aliya.id).value).toBe("Кандидат пишет, что не занимался");
  });

  it("достижения — только из резюме и помечены как непроверенные", () => {
    expect(cell(three, "achievements", aidar.id).value).toBe("Указаны в резюме, не проверены");
    expect(cell(three, "achievements", aidar.id).excerpt).toMatch(/110–125%/);
    expect(cell(three, "achievements", aliya.id).value).toBeNull();
  });

  it("интервью не проводилось — «нет данных», а не выдуманный результат", () => {
    for (const id of [aidar.id, ruslan.id, aliya.id]) expect(cell(three, "interview", id)).toMatchObject({ value: null, detail: "Предварительное интервью не проводилось" });
  });

  it("проверка навыков: результат есть только у того, кто её проходил, с пометкой о вымышленных ответах", () => {
    expect(cell(three, "challenge", aidar.id).value).toMatch(/Навыки проявлены на \d+%/);
    expect(cell(three, "challenge", aidar.id).detail).toContain("Ответы вымышлены");
    expect(cell(three, "challenge", ruslan.id).value).toBeNull();
  });

  it("зарплата сравнивается с вакансией", () => {
    expect(cell(three, "salary", aidar.id).value).toContain("в пределах вакансии");
    expect(cell(three, "salary", aliya.id).value).toBeNull();
  });

  it("отчёт: сильные стороны, отличия, пробелы, вопросы — без победителя", () => {
    const text = JSON.stringify(three.report);
    expect(three.report.strengths).toHaveLength(3);
    expect(three.report.differences.join(" ")).toMatch(/Самостоятельный поиск клиентов в резюме: есть у Айдар К., Руслан Т.; нет данных или нет у Алия М./);
    expect(text).not.toMatch(/лучш|победител|рекомендуем нанять|выбрать/i);
    expect(three.report.questions.every((q) => q.items.length > 0)).toBe(true);
  });

  it("неполное резюме не ломает сравнение", () => {
    const thin = make("Пустой", "Ищу работу менеджером. Готов обучаться, ответственный, коммуникабельный человек.", "thin");
    const result = buildComparison({ draft, candidates: [aidar, thin], challenges: [], weights: {}, names: { ...names, thin: "Пустой" } });
    expect(cell(result, "experience", "thin").value).toBeNull();
    expect(cell(result, "missing", "thin").value).toContain("профессиональный опыт");
  });

  it("сравнение не учитывает личные признаки", () => {
    const withPersonal = make("X", `${aidar.resumeText}\nВозраст: 45 лет\nПол: мужской\nСемейное положение: женат`, "x");
    const result = buildComparison({ draft, candidates: [withPersonal, ruslan], challenges: [], weights: {}, names: { x: "X", ...names } });
    expect(JSON.stringify(result)).not.toMatch(/45 лет|мужской|женат/);
  });
});
