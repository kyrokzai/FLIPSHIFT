import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/vacancies/intake/route";
import { IntakeResponseSchema } from "@/domain/vacancy/schema";
import { createRateLimiter } from "@/server/rate-limit";

const call = (body: unknown, ip = "10.0.0.1") =>
  POST(
    new Request("http://localhost/api/vacancies/intake", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

describe("POST /api/vacancies/intake", () => {
  it("возвращает черновик по контракту и запрещает кэширование", async () => {
    const response = await call({ message: "Мне нужны два бариста в Астане, зарплата 300 000 тенге, график 5/2" });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const data = IntakeResponseSchema.parse(await response.json());
    expect(data.draft.title).toBe("Бариста");
    expect(data.engine).toBe("rules");
  });

  it("отклоняет пустое и слишком длинное сообщение", async () => {
    const empty = await call({ message: " " });
    expect(empty.status).toBe(400);
    expect((await empty.json()).error).toBe("Опишите, кого вы ищете");

    const long = await call({ message: "а".repeat(2001) });
    expect(long.status).toBe(400);
  });

  it("отклоняет не-JSON и чужую структуру черновика", async () => {
    expect((await call("не json")).status).toBe(400);
    expect((await call({ message: "Нужен бариста", draft: { title: 42 } })).status).toBe(400);
  });

  it("отклоняет слишком большой запрос", async () => {
    const response = await call(JSON.stringify({ message: "Нужен бариста", padding: "x".repeat(40_000) }));
    expect(response.status).toBe(413);
  });

  it("ограничивает частоту запросов с одного адреса", async () => {
    let last = await call({ message: "Нужен бариста" }, "10.0.0.99");
    for (let i = 0; i < 25 && last.status === 200; i++) last = await call({ message: "Нужен бариста" }, "10.0.0.99");
    expect(last.status).toBe(429);
    expect(Number(last.headers.get("retry-after"))).toBeGreaterThan(0);
    expect((await call({ message: "Нужен бариста" }, "10.0.0.100")).status).toBe(200);
  });
});

describe("ограничитель частоты", () => {
  it("сбрасывает счётчик после окна", () => {
    let now = 0;
    const check = createRateLimiter(2, 1000, () => now);
    expect(check("a").allowed).toBe(true);
    expect(check("a").allowed).toBe(true);
    expect(check("a")).toEqual({ allowed: false, retryAfterSeconds: 1 });
    now = 1001;
    expect(check("a").allowed).toBe(true);
  });
});
