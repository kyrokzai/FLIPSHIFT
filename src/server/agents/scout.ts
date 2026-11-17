import { extractFacts } from "@/domain/candidate/extract";
import { assembleAnalysis, buildCriteria } from "@/domain/candidate/match";
import type { AnalyzeRequest, AnalyzeResponse } from "@/domain/candidate/schema";
import type { LlmProvider } from "@/server/llm";
import { refineCriteriaWithLlm } from "./scout-llm";

/**
 * Scout Agent: анализ резюме и сопоставление с вакансией.
 * Встроенная оценка работает всегда; модель, если подключена, уточняет её
 * одним вызовом на резюме.
 */
export async function handleResumeAnalysis(request: AnalyzeRequest, deps: { llm: LlmProvider | null; now?: Date }): Promise<AnalyzeResponse> {
  const facts = extractFacts(request.resumeText, { name: request.name, now: deps.now });
  const criteria = buildCriteria(request.vacancy, facts, request.resumeText);

  if (deps.llm) {
    const refined = await refineCriteriaWithLlm(deps.llm, request.vacancy, criteria, request.resumeText);
    if (refined) return { facts, analysis: assembleAnalysis(request.vacancy, refined.criteria, "llm", refined.summary) };
  }
  return { facts, analysis: assembleAnalysis(request.vacancy, criteria, "rules") };
}
