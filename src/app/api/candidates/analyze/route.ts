import { z } from "zod";
import { AnalyzeRequestSchema, ModeSchema } from "@/domain/candidate/schema";
import { handleResumeAnalysis } from "@/server/agents/scout";
import { json, rateGuard, readJson } from "@/server/http";
import { getLlmProvider } from "@/server/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const guard = rateGuard(Number(process.env.ANALYZE_RATE_LIMIT_PER_MINUTE) > 0 ? Number(process.env.ANALYZE_RATE_LIMIT_PER_MINUTE) : 60);
const RequestSchema = AnalyzeRequestSchema.extend({ mode: ModeSchema.default("live") });

/**
 * Анализ одного резюме по вакансии. Данные приходят в запросе и возвращаются
 * в ответе; на сервере ничего не сохраняется.
 */
export async function POST(request: Request) {
  const limited = guard(request);
  if (limited) return limited;

  const read = await readJson(request, 128 * 1024);
  if ("error" in read) return read.error;

  const parsed = RequestSchema.safeParse(read.body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const message = issue?.path[0] === "resumeText" && issue.message ? issue.message : "Не удалось прочитать запрос.";
    return json({ error: z.string().parse(message) }, 400);
  }

  try {
    // Синтетические резюме в DEMO оцениваются встроенным движком: платная модель на них не тратится.
    const llm = parsed.data.mode === "live" ? getLlmProvider() : null;
    return json(await handleResumeAnalysis(parsed.data, { llm }));
  } catch {
    console.error("[analyze] Сбой при анализе резюме");
    return json({ error: "Не удалось проанализировать резюме. Повторите попытку." }, 500);
  }
}
