import { describe, expect, it } from "vitest";
import { MAX_EVENTS_PER_VACANCY, appendEvent, eventGroups, eventTypes, sanitizeEventText, type NewEvent } from "@/domain/activity/events";

const base: NewEvent = { key: "k1", type: "resume_imported", actor: "employer", vacancyId: "v1", mode: "live", result: "Резюме добавлено текстом." };

describe("журнал действий", () => {
  it("пишет событие со всеми полями", () => {
    const [event] = appendEvent([], { ...base, candidateId: "c1", source: "hh.kz" }, "id1", 100);
    expect(event).toEqual({ id: "id1", key: "k1", at: 100, type: "resume_imported", actor: "employer", vacancyId: "v1", candidateId: "c1", mode: "live", status: "success", result: "Резюме добавлено текстом.", source: "hh.kz", errorCode: null });
  });

  it("не пишет одно и то же дважды", () => {
    const once = appendEvent([], base, "a", 1);
    const twice = appendEvent(once, { ...base, result: "другое" }, "b", 2);
    expect(twice).toBe(once);
    expect(twice).toHaveLength(1);
  });

  it("фиксирует ошибки с кодом и статусом", () => {
    const [event] = appendEvent([], { ...base, type: "resume_analysis_failed", status: "error", errorCode: "network <script>" }, "e", 1);
    expect(event).toMatchObject({ status: "error", errorCode: "networkscript" });
  });

  it("вырезает контакты, ключи и токены из текста событий", () => {
    const dirty = "Связь: ivan@example.com, +7 701 123 45 67, ключ sk-ant-abcdefghijklmnop, токен A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8";
    const clean = sanitizeEventText(dirty);
    expect(clean).not.toMatch(/example\.com|701 123|sk-ant|A1b2C3d4/);
    expect(clean).toContain("[почта скрыта]");
  });

  it("обрезает длинный текст и ограничивает размер журнала", () => {
    expect(sanitizeEventText("а".repeat(1000)).length).toBeLessThanOrEqual(300);
    let log = appendEvent([], { ...base, key: "k0" }, "0", 0);
    for (let i = 1; i <= MAX_EVENTS_PER_VACANCY + 5; i++) log = appendEvent(log, { ...base, key: `k${i}` }, String(i), i);
    expect(log).toHaveLength(MAX_EVENTS_PER_VACANCY);
    expect(log[0]!.key).toBe("k6");
  });

  it("каждый тип события входит в группу фильтра", () => {
    const grouped = Object.values(eventGroups).flatMap((g) => g.types);
    expect(new Set(grouped)).toEqual(new Set(eventTypes));
  });

  it("в журнале нет типа «найдено кандидатов» — автоматического поиска нет", () => {
    expect(eventTypes.join(" ")).not.toMatch(/found|search_completed/);
  });
});
