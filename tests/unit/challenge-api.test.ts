import { describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/challenges/turn/route";
import { CHALLENGE_SYSTEM_PROMPT, buildTurnPrompt, generateClientTurn } from "@/server/agents/challenge-llm";
import type { LlmProvider } from "@/server/llm";

const request = { templateId: "sales" as const, difficulty: "standard" as const, situationId: "price", history: [{ prompt: "Здравствуйте!", answer: "Добрый день, звоните: +7 701 123 45 67, ivan@example.com" }] };

describe("ИИ-собеседник для проверки навыков", () => {
  it("без подключённой модели — честный отказ 503, а не имитация", async () => {
    const response = await POST(new Request("http://localhost/api/challenges/turn", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "10.9.0.1" }, body: JSON.stringify(request) }));
    expect(response.status).toBe(503);
    expect((await response.json()).error).toContain("не подключена");
  });

  it("в запрос к модели не попадают контакты кандидата", () => {
    const prompt = buildTurnPrompt(request)!;
    expect(prompt).not.toMatch(/701 123|example\.com/);
    expect(prompt).toContain("Клиент не уверен в цене");
    expect(CHALLENGE_SYSTEM_PROMPT).toContain("не давай подсказок");
  });

  it("неизвестная ситуация не отправляется в модель", async () => {
    const generateObject = vi.fn();
    expect(await generateClientTurn({ name: "f", model: "f", generateObject } as unknown as LlmProvider, { ...request, situationId: "nope" })).toBeNull();
    expect(generateObject).not.toHaveBeenCalled();
  });

  it("реплика модели обрезается и пустой ответ не принимается", async () => {
    const make = (message: string) => ({ name: "f", model: "f", generateObject: vi.fn(async () => ({ message })) }) as unknown as LlmProvider;
    expect(await generateClientTurn(make("  Дороговато.  "), request)).toBe("Дороговато.");
    expect(await generateClientTurn(make("   "), request)).toBeNull();
    expect((await generateClientTurn(make("а".repeat(5000)), request))!.length).toBe(1200);
  });
});
