// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

const KEY = "formiq.talent-agent.vacancies.v1";

/** Вакансия в формате текущего production (main до обновления): без новых полей. */
const legacy = {
  id: "old-1", createdAt: 1, updatedAt: 2, status: "confirmed", draft: null, messages: [], skipped: [], engine: "rules",
  pending: null, failed: null, mode: "live", candidates: [],
};

describe("совместимость хранилища с опубликованной версией", () => {
  beforeEach(() => {
    window.localStorage.clear();
    // Модуль кэширует прочитанное — каждый тест получает свежую копию.
    return import("vitest").then(({ vi }) => vi.resetModules());
  });

  it("старая вакансия читается и получает пустые проверки, сравнение и журнал", async () => {
    window.localStorage.setItem(KEY, JSON.stringify([legacy]));
    const { getSession } = await import("@/lib/sessions");
    const session = getSession("old-1")!;
    expect(session).toBeTruthy();
    expect(session.challenges).toEqual([]);
    expect(session.compare).toEqual([]);
    expect(session.events).toEqual([]);
    expect(session.challengeWeights).toEqual({});
  });

  it("лишние элементы сравнения не делают вакансию нечитаемой", async () => {
    window.localStorage.setItem(KEY, JSON.stringify([{ ...legacy, compare: ["a", "b", "c", "d", "e", "f", "g", "h"] }]));
    const { getSession } = await import("@/lib/sessions");
    expect(getSession("old-1")!.compare).toHaveLength(6);
  });
});
