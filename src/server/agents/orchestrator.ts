import { findProtectedAttributes, mergeNotices } from "@/domain/vacancy/compliance";
import { applyPatch } from "@/domain/vacancy/merge";
import { parseEmployerMessage } from "@/domain/vacancy/parse";
import { computeQuestions, interpretAnswer, isAnswerTo } from "@/domain/vacancy/questions";
import { buildReply } from "@/domain/vacancy/reply";
import {
  emptyDraft,
  type Engine,
  type IntakeRequest,
  type IntakeResponse,
  type Notice,
  type VacancyDraft,
} from "@/domain/vacancy/schema";
import type { LlmProvider } from "@/server/llm";
import { refineWithLlm } from "./intake-llm";

/**
 * Orchestrator Agent, задача «приём вакансии».
 *
 * Экономия вызовов модели:
 *  1. сначала бесплатный разбор по справочникам;
 *  2. ответ на конкретный вопрос толкуется без модели;
 *  3. LLM вызывается один раз и только на свободное сообщение;
 *  4. если модель недоступна или ошиблась, остаётся результат шага 1.
 */

export interface IntakeDeps {
  llm: LlmProvider | null;
}

export async function handleVacancyIntake(request: IntakeRequest, deps: IntakeDeps): Promise<IntakeResponse> {
  const before = request.draft ?? null;
  const base = before ?? emptyDraft();
  const skipped = request.skipped ?? [];
  let engine: Engine = "rules";
  let notices: Notice[] = findProtectedAttributes(request.message);
  let draft: VacancyDraft;

  if (request.questionId && isAnswerTo(base, request.questionId, request.message)) {
    const patch = interpretAnswer(base, request.questionId, request.message);
    draft = applyPatch(base, patch, { lists: "append" });
  } else {
    const parsed = parseEmployerMessage(request.message, { hasTitle: !!base.title });
    draft = applyPatch(base, parsed.patch, { lists: "append" });

    if (deps.llm) {
      const refined = await refineWithLlm(deps.llm, draft, request.message);
      if (refined) {
        // Модель видела черновик целиком, поэтому её списки заменяют, а не дополняют.
        draft = applyPatch(draft, refined.patch, { lists: "replace" });
        notices = mergeNotices(notices, refined.notices);
        engine = "llm";
      }
    }
  }

  const questions = computeQuestions(draft, skipped);
  return {
    draft,
    reply: buildReply(before, draft, questions.length),
    notices,
    questions,
    engine,
  };
}
