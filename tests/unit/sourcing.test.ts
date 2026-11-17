import { describe, expect, it } from "vitest";
import { POST as analyze } from "@/app/api/candidates/analyze/route";
import { AnalyzeResponseSchema, type Candidate } from "@/domain/candidate/schema";
import { analyzeResume, vacancyKey } from "@/domain/candidate/match";
import { buildSearchPlan } from "@/domain/sourcing/queries";
import { SOURCE_CAPABILITIES, accessClasses, buildSearchLinks } from "@/domain/sourcing/sources";
import { applyPatch } from "@/domain/vacancy/merge";
import { parseEmployerMessage } from "@/domain/vacancy/parse";
import { emptyDraft } from "@/domain/vacancy/schema";
import { computeSteps } from "@/lib/hiring-steps";

const draft = applyPatch(emptyDraft(), parseEmployerMessage("Нужен менеджер по активным продажам мебели в Астане").patch);
const plan = buildSearchPlan(draft);

describe("поисковые запросы", () => {
  it("строятся из вакансии: точный, смежные названия, навыки", () => {
    expect(plan.queries.map((q) => q.id)).toEqual(["exact", "titles", "skills"]);
    expect(plan.queries[0]!.text).toBe("менеджер по активным продажам мебели");
    expect(plan.queries[1]!.boolean).toBe(
      '("менеджер по продажам" OR "менеджер по активным продажам" OR "sales manager" OR "менеджер по работе с клиентами" OR "менеджер по развитию бизнеса" OR "торговый представитель") AND (мебель OR кухни OR интерьер)',
    );
    expect(plan.queries[2]!.boolean).not.toMatch(/мебель/);
  });

  it("работают для должности без готовых синонимов", () => {
    const other = buildSearchPlan(applyPatch(emptyDraft(), parseEmployerMessage("Нужен сварщик в Павлодаре").patch));
    expect(other.queries[0]!.text).toBe("сварщик");
    expect(other.queries.length).toBeGreaterThanOrEqual(2);
  });

  it("ссылки ведут на поиск самих площадок, а не на сбор данных", () => {
    const links = buildSearchLinks(plan.queries[0]!, draft);
    const hh = new URL(links.find((l) => l.source === "hh.kz")!.url);
    expect(hh.origin + hh.pathname).toBe("https://hh.kz/search/resume");
    expect(hh.searchParams.get("text")).toBe("менеджер по активным продажам мебели");
    expect(hh.searchParams.get("area")).toBe("159");
    expect(links.every((l) => l.url.startsWith("https://"))).toBe(true);
  });
});

describe("реестр источников", () => {
  it("покрывает все пять классов доступа", () => {
    expect(new Set(SOURCE_CAPABILITIES.map((s) => s.access))).toEqual(new Set(accessClasses));
  });

  it("автоматического поиска без доступа нет: доступны только импорт и поиск с помощью агента", () => {
    expect(SOURCE_CAPABILITIES.filter((s) => s.status === "success").map((s) => s.id)).toEqual(["import", "assisted"]);
    expect(SOURCE_CAPABILITIES.filter((s) => s.access === "prohibited").every((s) => s.status === "prohibited")).toBe(true);
  });
});

describe("ход подбора", () => {
  const TEXT = "Тестовый Кандидат\nМенеджер по продажам мебели\nАстана\nОпыт работы: 5 лет\nАктивные продажи мебели, B2B, переговоры";
  const make = (mode: Candidate["mode"], analysed: boolean, error: string | null = null): Candidate => ({
    id: `${mode}-${analysed}-${error}`, mode, addedAt: 1, resumeText: TEXT, error,
    source: { kind: mode === "demo" ? "demo" : "text", label: "x", url: null, fileName: null },
    ...(analysed ? { ...analyzeResume(draft, TEXT), vacancyKey: vacancyKey(draft) } : { facts: null, analysis: null, vacancyKey: null }),
  });
  const statuses = (mode: Candidate["mode"], candidates: Candidate[]) =>
    Object.fromEntries(computeSteps({ draft, confirmed: true, mode, candidates, plan }).map((s) => [s.id, s.status]));

  it("LIVE без резюме: поиск требует доступа, остальное ждёт данных", () => {
    expect(statuses("live", [])).toEqual({
      vacancy: "success", queries: "success", sources: "needs_access", resumes: "waiting", analysis: "waiting", shortlist: "waiting", interview: "success",
    });
  });

  it("LIVE не видит демонстрационных кандидатов, DEMO — настоящих", () => {
    const mixed = [make("demo", true), make("live", true)];
    const live = computeSteps({ draft, confirmed: true, mode: "live", candidates: mixed, plan });
    expect(live.find((s) => s.id === "resumes")!.detail).toBe("Добавлено: 1 кандидат.");
    expect(statuses("live", [make("demo", true)]).resumes).toBe("waiting");
    expect(statuses("demo", [make("live", true)]).resumes).toBe("waiting");
  });

  it("показывает выполнение и ошибку анализа", () => {
    expect(statuses("live", [make("live", false)]).analysis).toBe("running");
    expect(statuses("live", [make("live", false, "сбой")]).analysis).toBe("error");
    expect(statuses("live", [make("live", true)]).analysis).toBe("success");
  });

  it("сообщает, что оценки устарели после изменения вакансии", () => {
    const changed = applyPatch(draft, { schedule: "2/2" });
    const steps = computeSteps({ draft: changed, confirmed: true, mode: "live", candidates: [make("live", true)], plan });
    expect(steps.find((s) => s.id === "analysis")!.detail).toContain("оценки нужно пересчитать");
  });
});

describe("POST /api/candidates/analyze", () => {
  const call = (body: unknown) =>
    analyze(new Request("http://localhost/api/candidates/analyze", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "10.1.0.1" }, body: JSON.stringify(body) }));

  it("возвращает анализ по контракту", async () => {
    const response = await call({ vacancy: draft, resumeText: "Тестовый Кандидат\nМенеджер по продажам мебели, Астана. Опыт работы: 5 лет. Активные продажи, B2B.", mode: "live" });
    expect(response.status).toBe(200);
    const data = AnalyzeResponseSchema.parse(await response.json());
    expect(data.analysis.engine).toBe("rules");
    expect(data.facts.city).toBe("Астана");
  });

  it("отклоняет слишком короткое резюме и чужую структуру", async () => {
    const short = await call({ vacancy: draft, resumeText: "привет" });
    expect(short.status).toBe(400);
    expect((await short.json()).error).toBe("В резюме слишком мало текста для анализа");
    expect((await call({ vacancy: { title: 1 }, resumeText: "x".repeat(100) })).status).toBe(400);
  });
});
