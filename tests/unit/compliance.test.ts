import { describe, expect, it } from "vitest";
import { findProtectedAttributes, withoutProtected } from "@/domain/vacancy/compliance";
import { parseEmployerMessage } from "@/domain/vacancy/parse";

describe("защищённые признаки", () => {
  it("находит пол и возраст и не переносит их в вакансию", () => {
    const { patch, notices } = parseEmployerMessage("Нужна девушка до 30 лет на ресепшн в салон красоты в Алматы");
    expect(notices.map((notice) => notice.attribute).sort()).toEqual(["age", "gender"]);
    expect(patch.title).toBe("Администратор ресепшн");
    expect(JSON.stringify(patch)).not.toMatch(/девушк|30 лет/i);
  });

  it("объясняет, почему условие исключено", () => {
    const [notice] = findProtectedAttributes("только мужчины");
    expect(notice?.message).toContain("защищённый признак");
  });

  it.each([
    ["славянской внешности", "ethnicity"],
    ["без детей", "family"],
    ["приятной внешности", "appearance"],
    ["мусульманин", "religion"],
    ["без инвалидности", "health"],
    ["не старше 40 лет", "age"],
  ])("распознаёт «%s»", (text, attribute) => {
    expect(findProtectedAttributes(`Нужен продавец, ${text}`).map((n) => n.attribute)).toContain(attribute);
  });

  it("не считает опыт возрастом", () => {
    expect(findProtectedAttributes("Нужен бухгалтер, опыт от 10 лет")).toEqual([]);
    expect(findProtectedAttributes("стаж до 15 лет")).toEqual([]);
  });

  it("не трогает требования, связанные с работой", () => {
    expect(findProtectedAttributes("Нужен водитель с правами категории B и медкнижкой, ночные смены")).toEqual([]);
  });

  it("убирает пункты с защищёнными признаками из списков", () => {
    expect(withoutProtected(["Знание кассы", "Возраст до 35 лет", "Только девушки"])).toEqual(["Знание кассы"]);
  });
});
